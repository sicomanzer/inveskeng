# Inveskeng (Investing.com Most Undervalued Stocks Clone) 📈

โคลนระบบ **Most Undervalued Equities** จาก [Investing.com Thailand](https://www.investing.com/equities/thailand/most-undervalued) สร้างด้วย **Next.js 15 (App Router)**, **React 19**, **Tailwind CSS**, และ **TanStack Table v8** พร้อมระบบ **Live Auto-Sync Engine** และ **2 ภาษา (Bilingual)**

---

## ✨ Features (จุดเด่นของระบบ)

1. **📊 Undervalued Equities Table (ตารางจำลองเหมือนต้นฉบับ 100%)**
   - รองรับทั้ง **🇹🇭 ตลาดหุ้นไทย (SET)** และ **🇺🇸 ตลาดหุ้นสหรัฐฯ (US)**
   - คอลัมน์ตรึงด้านซ้าย (Sticky Column) สำหรับชื่อย่อและชื่อบริษัท
   - การเรียงลำดับ (Sorting) ตาม Upside %, ราคา, Fair Value, P/E Ratio, Market Cap
   - กรองข้อมูลตามคะแนนสุขภาพทางการเงิน (Financial Health: All, Great, Good, Fair)
   - ฟอนต์ทางการ `Inter` และระยะห่างช่อง (Cell Spacing) ตรงตาม Investing.com จริง

2. **🌐 เว็บไซต์ 2 ภาษา (Bilingual: 🇹🇭 ไทย / 🇬🇧 English)**
   - สลับภาษาระหว่างภาษาไทยและภาษาอังกฤษได้ง่ายดายจาก Navbar
   - แปลเนื้อหาครบถ้วน: หัวข้อ, การ์ดสรุปสถิติ KPI, คอลัมน์, เรตติ้งสถานะ, และตัวกรอง
   - บันทึกการตั้งค่าภาษาลง `localStorage` อัตโนมัติ

3. **🌓 สลับโหมด สว่าง / มืด (Light & Pro Dark Mode)**
   - ไอคอนเลือกธีม (☀️ Sun / 🌙 Moon) บน Navbar
   - โหมดสว่างสะอาดตาตรงตามหน้าเว็บจริง และโหมดมืดเกรดการเงินมืออาชีพ
   - บันทึกสถานะธีมลง `localStorage`

4. **⚡ Live Auto-Sync Engine (ระบบอัปเดตข้อมูลอัตโนมัติ)**
   - **Background Scheduler Daemon:** อัปเดตข้อมูลตรงจาก Investing.com ทุก 15 นาที
   - **One-Click Sync:** ปุ่มกดซิงค์ข้อมูลสดทันทีจากหน้าบ้าน (`[🔄 ซิงค์ข้อมูลสด]`)
   - **Bypass Cloudflare WAF:** ใช้สถาปัตยกรรม TLS Handshake Impersonation (`curl_cffi`) ดึงข้อมูลจริง 30 หุ้นพร้อมปลดล็อกชื่อหุ้นที่ถูกบัง (Masked Data)

---

## 🛠️ Tech Stack

- **Framework:** Next.js 15.5+ (App Router)
- **UI Library:** React 19, Tailwind CSS, Lucide Icons
- **Data Table:** TanStack Table v8
- **Sync Engine:** Python 3.10+, `curl_cffi` (Chrome TLS Impersonation)

---

## 🚀 Getting Started (วิธีติดตั้งและเปิดใช้งาน)

### 1. ติดตั้ง Dependencies
```bash
npm install
pip install curl_cffi
```

### 2. รันระบบเซิร์ฟเวอร์ (Development)
```bash
npm run dev
```
เปิดเบราว์เซอร์ไปที่: `http://localhost:3000`

### 3. Build & Run Production
```bash
npm run build
npm start
```

### 4. รันระบบ Background Auto-Sync (ถ้าต้องการให้อัปเดตอัตโนมัติทุก 15 นาที)
```bash
python scripts/scheduler.py
```
หรือสั่งซิงค์ข้อมูลรอบเดียวแบบ Manual:
```bash
python scripts/sync_data.py --market=ALL
```

---

## 📄 License
MIT License
