---
title: "Zero-Day Exploit: Remote Code Execution in SoHo Routers"
description: "A deep dive into reverse engineering and exploiting a buffer overflow vulnerability in a popular SoHo router firmware to gain remote root access."
date: "2026-05-15"
tags: ["exploitation", "reverse-engineering", "mips", "zero-day"]
category: "Vulnerability Research"
cover_image: "/images/covers/rce-router-cover.svg"
draft: false
---

## Executive Summary

During an audit of a popular SoHo (Small Office/Home Office) router brand, we uncovered a critical stack-based buffer overflow vulnerability in the router’s administrative interface web server. The flaw allows unauthenticated remote attackers on the local network (or wide area network if administration interfaces are exposed) to execute arbitrary code with root privileges.

This writeup details the discovery process, reverse engineering the firmware, crafting a stable exploit payload bypassing standard constraints, and remediation recommendations.

---

## 1. Firmware Extraction and Emulation

First, we obtained the router’s firmware update binary from the vendor's support portal. Using `binwalk`, we unpacked the squashfs filesystem:

```bash
binwalk -e firmware_v1.0.4.bin
```

Once extracted, we identified the target binary responsible for the web interface, `/usr/sbin/httpd`. Since the router runs on a MIPS big-endian architecture, we emulated the web server binary locally using `qemu-mips-static` combined with `chroot`:

```bash
sudo cp $(which qemu-mips-static) ./squashfs-root/
sudo chroot ./squashfs-root/ ./qemu-mips-static /usr/sbin/httpd
```

---

## 2. Vulnerability Discovery (The Buffer Overflow)

Using Ghidra, we analyzed the HTTP request processing code in the `httpd` binary. We found a parsing function responsible for handling the `Cookie` header. 

Here is the decompiled representation of the vulnerable code segment:

```c
void parse_cookie_header(char *http_header) {
  char local_buffer[256];
  char *cookie_ptr;
  
  cookie_ptr = strstr(http_header, "Cookie: SESSION_ID=");
  if (cookie_ptr != (char *)0x0) {
    // VULNERABLE: strcpy does not check bounds before writing to local_buffer
    strcpy(local_buffer, cookie_ptr + 19);
  }
}
```

The stack buffer `local_buffer` is allocated exactly 256 bytes. However, `strcpy` continues copying from the HTTP header until it reaches a null terminator or a semicolon. An attacker providing a cookie larger than 256 bytes can overwrite the stack frame, including the saved frame pointer and return address.

---

## 3. Exploit Crafting (MIPS Stack Smashing)

Unlike x86 architectures, MIPS lacks a return instruction that pulls addresses directly from the stack inside leaf functions. Instead, MIPS relies on the Link Register (`$ra`) to jump back. When a function finishes, it restores `$ra` from the stack and jumps via `jr $ra`.

To successfully redirect control flow, our payload layout must look like this:

| Buffer Fill (256 bytes) | Saved Frame Pointer (4 bytes) | Overwritten Return Address (4 bytes) | Shellcode |
| :--- | :--- | :--- | :--- |
| `A * 256` | `B * 4` | Target Address (Gadget) | MIPS Shellcode |

Because the stack address changes across devices, we used a `Return-oriented Programming (ROP)` gadget to jump directly to our shellcode. We found a suitable gadget in `libuClibc-0.9.30.so`:

```text
move $t9, $sp
jr $t9
```

This gadget transfers execution to the stack address (`$sp`) containing our shellcode payload.

### The Shellcode (MIPS Big-Endian Bind Shell)

We drafted a compact shellcode (48 bytes) that binds a root shell on port `9999`:

```python
# MIPS shellcode representation
shellcode = (
    b"\x24\x06\xff\xff"  # li a2, -1
    b"\x24\x02\x10\x46"  # li v0, 4166 (sys_socket)
    # ... rest of socket & bind code ...
)
```

---

## 4. Remediation and Conclusion

We reported this vulnerability under responsible disclosure. To remediate this issue, the `strcpy` call must be replaced with `strncpy`, ensuring that we restrict the copies to the destination buffer's maximum capacity (256 bytes minus 1 for the null terminator).

### Safe Implementation:

```c
strncpy(local_buffer, cookie_ptr + 19, sizeof(local_buffer) - 1);
local_buffer[sizeof(local_buffer) - 1] = '\0';
```

The vendor has released a patch in `v1.0.5` addressing this vulnerability.
