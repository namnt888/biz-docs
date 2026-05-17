# Account & Category Keywords Master Lookup

## 1. Tổng quan

File này là **MASTER LOOKUP TABLE** kết hợp 2 chiều dành cho AI Agent:
- **keyword → account**: Parse "super" → resolve thành VIB Super Card
- **keyword → category**: Parse "shopee" → resolve thành online_shopping
- **category → account phù hợp**: Tư vấn "thẻ nào mua bảo hiểm tốt nhất?" → VPBank Lady

### Mục đích sử dụng

Agent dùng file này để:
1. **Parse raw transaction text** từ user chat
   - Input: `"shopee, ốp lưng -500k super"`
   - Output: `account_code=vib_super, category_code=online_shopping`

2. **Trả lời câu hỏi tư vấn thẻ** theo category
   - Input: `"thẻ nào tốt nhất cho mua bảo hiểm?"`
   - Output: `VPBank Lady Card - 15% max 300k (khi spend ≥ 15M/kỳ)`

3. **Tính cashback projection** khi thêm chi tiêu
   - Input: `"đã chi 14.9tr bảo hiểm, mua thêm 5tr thì back bao nhiêu?"`
   - Output: Breakdown chi tiết theo tier và cap

---

## 2. Account Keyword Mapping

Bảng mapping từ khóa người dùng hay nhắn → account code.

| keyword | account_code | account_name | match_type | disambiguation_hint | notes |
|---------|-------------|--------------|------------|---------------------|-------|
| **THẺ TÍN DỤNG (CREDIT CARDS)** |||||
| super, vib super | vib_super | VIB Super Card | prefix | | Cashback 5% không giới hạn cho online shopping |
| vpbank lady, lady, thẻ lady | vpbank_lady | VPBank Lady Card | exact | "thẻ/credit" → credit card | 15% max 300k cho insurance (spend ≥ 15M) |
| techcombank, tcb, thẻ tcb | tcb_credit | Techcombank Visa Credit | prefix | "thẻ/credit" → credit card | Cashback theo chương trình từng thời kỳ |
| vietcombank, vcb, vcb credit | vcb_credit | VCB Credit Card | prefix | "thẻ/credit" → credit card | |
| mb bank, mb, mb credit | mb_credit | MB Credit Card | prefix | "thẻ/credit" → credit card | |
| ocb, ocb visa | ocb_visa | OCB Visa Card | prefix | "thẻ/credit" → credit card | |
| shinhan, shinhan visa | shinhan_visa | Shinhan Visa Card | prefix | "thẻ/credit" → credit card | |
| tpbank, tpbank credit, tp credit | tpbank_credit | TPBank Visa Credit | prefix | "thẻ/credit" → credit card | |
| sacombank, saco, saco visa | saco_visa | Sacombank Visa Card | prefix | "thẻ/credit" → credit card | |
| uob, uob one | uob_one | UOB ONE Card | exact | "thẻ/credit" → credit card | 5% cho dining + grocery |
| citibank, citi, citi credit | citi_credit | Citibank Credit Card | prefix | "thẻ/credit" → credit card | |
| hsbc, hsbc visa, hsbc platinum | hsbc_platinum | HSBC Visa Platinum | prefix | "thẻ/credit" → credit card | |
| **VÍ ĐIỆN TỬ (E-WALLETS)** |||||
| momo, ví momo, vi momo | momo_wallet | MoMo Wallet | exact | | Ví điện tử phổ biến nhất |
| zalopay, zalo pay, ví zalopay | zalopay_wallet | ZaloPay Wallet | exact | | Tích hợp Zalo |
| vnpay, ví vnpay, vi vnpay | vnpay_wallet | VNPay Wallet | exact | | Qua app VNPay |
| **TÀI KHOẢN NGÂN HÀNG (DEBIT/SAVINGS)** |||||
| tcb account, tài khoản tcb | tcb_debit | Techcombank Debit | prefix | "tài khoản/save" → debit | Tài khoản thanh toán |
| vcb, vietcombank, vcb debit | vcb_debit | VCB Debit Account | prefix | "tài khoản/save" → debit | |
| mb, mb bank, mb account | mb_debit | MB Bank Account | prefix | "tài khoản/save" → debit | |
| bidv, bidv account | bidv_debit | BIDV Account | prefix | "tài khoản/save" → debit | |
| vietinbank, tin, vietin | vietin_debit | Vietinbank Account | prefix | "tài khoản/save" → debit | |
| agribank, agribank account | agribank_debit | Agribank Account | prefix | "tài khoản/save" → debit | |
| tpbank debit, tp debit, tài khoản tp | tpbank_debit | TPBank Debit | prefix | "tài khoản/save" → debit | |
| vpbank, vpbank save, tài khoản vpbank | vpbank_debit | VPBank Savings | prefix | "tài khoản/save" → debit | Phân biệt với VPBank Lady (credit) |
| sacombank account, saco account | saco_debit | Sacombank Account | prefix | "tài khoản/save" → debit | |
| **TIỀN MẶT** |||||
| cash, tiền mặt, tm, tiền tươi | cash | Tiền mặt | exact | | Giao dịch tiền mặt vật lý |

### Ghi chú Disambiguation

| Từ khóa ambiguous | Cách phân biệt |
|------------------|----------------|
| `vpbank` | "thẻ/lady/credit" → vpbank_lady; "tài khoản/save" → vpbank_debit |
| `techcombank, tcb` | "thẻ/credit" → tcb_credit; mặc định → tcb_debit |
| `vietcombank, vcb` | "thẻ/credit" → vcb_credit; mặc định → vcb_debit |
| `mb, mb bank` | "thẻ/credit" → mb_credit; mặc định → mb_debit |
| `tpbank, tp` | "thẻ/credit" → tpbank_credit; mặc định → tpbank_debit |
| `sacombank, saco` | "thẻ/visa" → saco_visa; mặc định → saco_debit |

---

## 3. Category Keyword Mapping

Bảng mapping từ khóa / tên merchant → category code.

### Ăn uống (food_drink)

| keyword | category_code | category_name_vi | affects_cashback | notes |
|---------|--------------|------------------|------------------|-------|
| highlands, phúc long, the coffee house, gong cha, katinat, starbucks, trung nguyên | cafe | Cà phê & trà | TRUE | |
| grab food, grabfood, shopee food, baemin, gojek food, now food | food_delivery | Đặt đồ ăn online | TRUE | Phân biệt với rideshare |
| lotteria, mcdonald's, kfc, jollibee, popeyes, burger king | dining_out | Ăn ngoài | TRUE | Fast food |
| nhà hàng, quán ăn, buffet, lẩu, nướng | dining_out | Ăn ngoài | TRUE | Nhà hàng thông thường |
| winmart, vinmart, bách hóa xanh, coopmart, mm mega market, lotte mart, go! | grocery | Siêu thị & tạp hóa | TRUE | |
| circle k, gs25, familymart, 7-eleven, minimart | grocery | Siêu thị & tạp hóa | TRUE | Có thể là food_drink nếu mua đồ ăn tại chỗ |
| coca, pepsi, nước ngọt, nước suối | beverage | Đồ uống đóng chai | FALSE | Thường không có cashback |

### Mua sắm (shopping)

| keyword | category_code | category_name_vi | affects_cashback | notes |
|---------|--------------|------------------|------------------|-------|
| shopee, shopee mall | online_shopping | Mua sắm online | TRUE | VIB Super 5% |
| lazada, lazada mall | online_shopping | Mua sắm online | TRUE | VIB Super 5% |
| tiki, tiki trading | online_shopping | Mua sắm online | TRUE | VIB Super 5% |
| tiktok shop, tiktok | online_shopping | Mua sắm online | TRUE | |
| sendo | online_shopping | Mua sắm online | TRUE | |
| amazon | online_shopping | Mua sắm online | TRUE | |
| uniqlo, zara, h&m, gap, canifa, việt tiến | fashion | Thời trang & phụ kiện | TRUE | |
| guardian, watsons, hasaki, beauty box | beauty | Mỹ phẩm & làm đẹp | TRUE | |
| thế giới di động, tgdd, fpt shop, cellphones, dien may xanh | electronics | Điện tử & công nghệ | TRUE | |
| ikea, nội thất hòa phát, sofa, giường, bàn ghế | home_goods | Gia dụng & nội thất | TRUE | |
| nhà sách phương nam, Fahasa, tiki sách | books | Sách & văn phòng phẩm | FALSE | |

### Di chuyển (transport)

| keyword | category_code | category_name_vi | affects_cashback | notes |
|---------|--------------|------------------|------------------|-------|
| grab car, be, xanh sm, gojek car, taxi mai linh, taxi vinsmarts | rideshare | Taxi & ride-hailing | TRUE | Phân biệt với food_delivery |
| xăng, petrol, petrolimex, shell, pvoil, bp, cnpc | fuel | Xăng dầu | TRUE | |
| giữ xe, parking, bãi xe | parking | Gửi xe & parking | FALSE | |
| xe bus, metro, tàu điện | public_transit | Phương tiện công cộng | FALSE | |
| rửa xe, thay nhớt, sửa xe, bảo dưỡng | vehicle_maintenance | Bảo dưỡng xe | FALSE | |

### Hóa đơn & Dịch vụ (bills_services)

| keyword | category_code | category_name_vi | affects_cashback | notes |
|---------|--------------|------------------|------------------|-------|
| điện, evn, tiền điện | electricity | Điện | FALSE | |
| nước, sawaco, bwaco, tiền nước | water | Nước | FALSE | |
| viettel, mobifone, vinaphone, vnpt, money, internet, wifi | telecom | Internet & điện thoại | FALSE | |
| netflix, hbo go, disney+ | streaming | Streaming | FALSE | Một số thẻ miễn phí |
| spotify, apple music, youtube premium | streaming | Streaming | FALSE | |
| tiền nhà, thuê nhà, rent, hostel | rent | Thuê nhà | FALSE | |
| phí ngân hàng, phí chuyển khoản, atm fee | bank_fee | Phí ngân hàng | FALSE | |

### Bảo hiểm (insurance) ⭐ QUAN TRỌNG

| keyword | category_code | category_name_vi | affects_cashback | notes |
|---------|--------------|------------------|------------------|-------|
| bảo hiểm, insurance | insurance | Bảo hiểm | TRUE | VPBank Lady 15% |
| manulife, prudential, aia, generali, dai-ichi | life_insurance | Bảo hiểm nhân thọ | TRUE | |
| bảo việt, pvi, bic, vbi, pjico, pti | insurance | Bảo hiểm | TRUE | |
| bảo hiểm sức khỏe, health insurance | health_insurance | Bảo hiểm sức khỏe | TRUE | |
| bảo hiểm xe, vehicle insurance | vehicle_insurance | Bảo hiểm xe | TRUE | |

### Sức khỏe (health)

| keyword | category_code | category_name_vi | affects_cashback | notes |
|---------|--------------|------------------|------------------|-------|
| vinmec, medlatec, bệnh viện, phòng khám, thuốc, pharmacy | medical | Khám bệnh & thuốc | FALSE | |
| gym, fit24, california fitness, the gym, yoga, celeb fitness | fitness | Gym & thể thao | FALSE | |
| spa, nail, salon, cắt tóc, gội đầu, làm đẹp | beauty | Spa & làm đẹp | FALSE | |

### Giải trí (entertainment)

| keyword | category_code | category_name_vi | affects_cashback | notes |
|---------|--------------|------------------|------------------|-------|
| rạp chiếu phim, cgv, lotte cinema, galaxy, bhd star | cinema | Rạp chiếu phim | FALSE | |
| game, steam, epic games, playstation, xbox | gaming | Game | FALSE | |
| concert, liveshow, sự kiện, vé xem show | events | Sự kiện & concert | FALSE | |

### Giáo dục (education)

| keyword | category_code | category_name_vi | affects_cashback | notes |
|---------|--------------|------------------|------------------|-------|
| học phí, tuition, trường học | tuition | Học phí | FALSE | |
| udemy, coursera, kyna, edx, skillshare | online_course | Khóa học online | FALSE | |

### Du lịch (travel)

| keyword | category_code | category_name_vi | affects_cashback | notes |
|---------|--------------|------------------|------------------|-------|
| vietjet, bamboo airways, vietnam airlines, pacific airlines | flight | Vé máy bay | TRUE | Một số thẻ có ưu đãi |
| booking.com, agoda, airbnb, khách sạn, resort, hotel | hotel | Khách sạn | TRUE | |
| tour, du lịch, travel, kỳ nghỉ | tour_activity | Tour & hoạt động | FALSE | |

### Thu nhập (income)

| keyword | category_code | category_name_vi | affects_cashback | notes |
|---------|--------------|------------------|------------------|-------|
| lương, salary, payroll | salary | Lương | FALSE | Không tính cashback |
| thưởng, bonus, tet bonus | bonus | Thưởng | FALSE | |
| freelance, freelancer, dự án | freelance | Freelance | FALSE | |
| lãi suất, cổ tức, đầu tư | investment_return | Lãi suất & đầu tư | FALSE | |
| hoàn tiền, refund, trả lại | refund_income | Hoàn tiền & refund | FALSE | |

### Chuyển khoản nội bộ (internal_transfer)

| keyword | category_code | category_name_vi | affects_cashback | notes |
|---------|--------------|------------------|------------------|-------|
| chuyển khoản, transfer, ck nội bộ, chuyển sang, nạp vào | internal_transfer | Chuyển khoản nội bộ | FALSE | Không ảnh hưởng cashback |

### Khác (other)

| keyword | category_code | category_name_vi | affects_cashback | notes |
|---------|--------------|------------------|------------------|-------|
| từ thiện, quyên góp, donation | donation | Từ thiện & quyên góp | FALSE | |
| quà tặng, gift, sinh nhật | gift | Quà tặng | FALSE | |
| không rõ, ??? | uncategorized | Không xác định | FALSE | Default fallback |

---

## 4. Category → Best Account (Tư vấn thẻ)

**QUAN TRỌNG NHẤT** cho chatbot tư vấn. Khi người dùng hỏi "thẻ nào tốt nhất cho X?", lookup bảng này.

| category_code | category_name_vi | best_account_1 | cashback_rate_1 | condition_1 | best_account_2 | cashback_rate_2 | condition_2 | notes |
|--------------|------------------|----------------|-----------------|-------------|----------------|-----------------|-------------|-------|
| **insurance** | Bảo hiểm | vpbank_lady | 15% | spend ≥ 15M/kỳ, max 300k | vpbank_lady | 7.5% | spend < 15M/kỳ, max 100k | **VPBank Lady vô địch category này** |
| **online_shopping** | Mua sắm online | vib_super | 5% | Không giới hạn, Shopee/Lazada/Tiki | ocb_visa | TODO | Cần xác nhận policy | VIB Super 5% không trần |
| **dining_out** | Ăn ngoài | uob_one | 5% | spend ≥ 15M/kỳ | mb_credit | TODO | Cần xác nhận policy | UOB ONE cho dining + grocery |
| **cafe** | Cà phê & trà | uob_one | 5% | spend ≥ 15M/kỳ | TODO | TODO | | Thuộc nhóm dining của UOB |
| **grocery** | Siêu thị & tạp hóa | uob_one | 5% | spend ≥ 15M/kỳ | TODO | TODO | | UOB ONE cho grocery + dining |
| **fuel** | Xăng dầu | TODO | TODO | Cần nghiên cứu | TODO | TODO | | Chưa có data chính xác |
| **streaming** | Streaming | TODO | Miễn phí | Tùy thẻ | TODO | Miễn phí | | Một số thẻ miễn phí Netflix/Spotify |
| **flight** | Vé máy bay | TODO | TODO | Cần nghiên cứu | TODO | TODO | | Thẻ travel thường có ưu đãi |
| **hotel** | Khách sạn | TODO | TODO | Cần nghiên cứu | TODO | TODO | | Thẻ travel thường có ưu đãi |
| **food_delivery** | Đặt đồ ăn online | vib_super | 5% | Nếu qua Shopee Food | TODO | TODO | | Phụ thuộc platform |
| **fashion** | Thời trang | TODO | TODO | Cần nghiên cứu | TODO | TODO | | |
| **electronics** | Điện tử | TODO | TODO | Cần nghiên cứu | TODO | TODO | | |
| **beauty** | Mỹ phẩm | TODO | TODO | Cần nghiên cứu | TODO | TODO | | |
| **medical** | Khám bệnh & thuốc | TODO | TODO | | TODO | TODO | | Thường không có cashback |
| **fitness** | Gym & thể thao | TODO | TODO | | TODO | TODO | | |
| **cinema** | Rạp chiếu phim | TODO | TODO | | TODO | TODO | | |

### Ghi chú quan trọng

- **VPBank Lady Card** là thẻ tốt nhất cho **insurance** (bảo hiểm) với 15% max 300k khi chi ≥ 15M/kỳ
- **VIB Super Card** là thẻ tốt nhất cho **online_shopping** với 5% không giới hạn
- **UOB ONE Card** là thẻ tốt nhất cho **dining + grocery** với 5% khi chi ≥ 15M/kỳ
- Các category khác: TODO cần nghiên cứu thêm policy của từng thẻ

---

## 5. Disambiguation Rules

Quy tắc xử lý keyword ambiguous (một từ khóa có thể thuộc nhiều categories).

### Grab

| Context | Kết quả | Lý do |
|---------|---------|-------|
| "grab food", "đặt đồ ăn grab", "grab giao hàng" | food_delivery | Rõ ràng là đặt đồ ăn |
| "grab car", "đi grab", "grab xe", "grab về nhà" | rideshare | Rõ ràng là đi xe |
| Chỉ "grab" không context | rideshare (default) | Default là rideshare, kèm note hỏi lại user |

### VPBank

| Context | Kết quả | Lý do |
|---------|---------|-------|
| "vpbank lady", "thẻ lady", "lady card" | vpbank_lady (credit) | Rõ ràng là thẻ tín dụng |
| "vpbank", "tài khoản vpbank", "save vpbank" | vpbank_debit (debit) | Tài khoản thanh toán/tiết kiệm |
| Chỉ "vpbank" không context | Hỏi lại user | Ambiguous, cần clarifying question |

### Techcombank

| Context | Kết quả | Lý do |
|---------|---------|-------|
| "thẻ tcb", "tcb credit", "tcb visa" | tcb_credit | Rõ ràng là thẻ tín dụng |
| "tcb", "techcombank", "tài khoản tcb" | tcb_debit (default) | Mặc định là tài khoản thanh toán |

### Circle K / GS25 / FamilyMart

| Context | Kết quả | Lý do |
|---------|---------|-------|
| "circle k cơm", "circle k đồ ăn" | food_drink/grocery | Mua đồ ăn tại chỗ |
| "circle k đồ dùng", "circle k văn phòng phẩm" | shopping/other | Mua đồ dùng |
| Chỉ "circle k" không context | grocery (default) | Default là grocery |

### Shopee

| Context | Kết quả | Lý do |
|---------|---------|-------|
| "shopee food" | food_delivery | Rõ ràng là đặt đồ ăn |
| "shopee", "shopee mall", mua hàng trên shopee" | online_shopping | Mặc định là mua sắm online |

### Budget / Tien Ich / Ung Dung

| Context | Kết quả | Lý do |
|---------|---------|-------|
| "ngân sách", "budget", "hạn mức" | budget (feature) | Tính năng budget, không phải category |
| "tiện ích", "ứng dụng", "app" | bills_services | Thanh toán hóa đơn qua app |

---

## 6. Conflict Resolution Priority

Khi một keyword match nhiều categories hoặc accounts, áp dụng thứ tự ưu tiên sau:

### Mức độ ưu tiên

1. **Merchant name match (cao nhất)**
   - Ví dụ: "Manulife" → insurance (không phải spending thông thường)
   - Ví dụ: "Netflix" → streaming (không phải entertainment chung chung)

2. **Context keyword match (ưu tiên thứ 2)**
   - Ví dụ: "bảo hiểm Manulife" → insurance confirmed
   - Ví dụ: "grab food" → food_delivery (không phải rideshare)

3. **Specific category match (ưu tiên thứ 3)**
   - Level 2 category ưu tiên hơn Level 1
   - Ví dụ: "cafe" → cafe (Level 2) thay vì food_drink (Level 1)

4. **Default category match (fallback)**
   - Nếu không có context rõ ràng, dùng default
   - Ví dụ: "grab" → rideshare (default)

5. **Uncategorized + flag user confirm (thấp nhất)**
   - Nếu vẫn không rõ → uncategorized
   - Flag để user xác nhận manually

### Flow xử lý

```
Input: "{raw_text}"
↓
Step 1: Exact merchant match? → YES → Done
↓ NO
Step 2: Context keyword match? → YES → Done
↓ NO
Step 3: Specific category match? → YES → Done
↓ NO
Step 4: Default match → Done
↓
Output: {account_code, category_code, confidence_level}
```

---

## 7. Prompt Template cho Agent

### Template 1: Parse Transaction từ Raw Text

```
INPUT: "{raw_text}"

Bước 1: Lookup Section 2 (Account Keyword Mapping)
  - Tìm keyword match trong raw_text
  - Nếu multiple matches → apply disambiguation rules (Section 5)
  - Extract: account_code, account_name

Bước 2: Lookup Section 3 (Category Keyword Mapping)
  - Tìm merchant/category keyword trong raw_text
  - Nếu multiple matches → apply conflict resolution (Section 6)
  - Extract: category_code, category_name_vi

Bước 3: Validate
  - account_code có tồn tại?
  - category_code có tồn tại?
  - Confidence level: high/medium/low

Bước 4: Output JSON
{
  "account_code": "<resolved account code>",
  "account_name": "<tên đầy đủ>",
  "category_code": "<resolved category code>",
  "category_name_vi": "<tên tiếng Việt>",
  "confidence": "high|medium|low",
  "disambiguation_needed": true|false,
  "notes": "<ghi chú nếu cần clarifying question>"
}

Ví dụ:
Input: "shopee, ốp lưng -500k super"
Output:
{
  "account_code": "vib_super",
  "account_name": "VIB Super Card",
  "category_code": "online_shopping",
  "category_name_vi": "Mua sắm online",
  "confidence": "high",
  "disambiguation_needed": false,
  "notes": ""
}
```

### Template 2: Tư vấn thẻ theo Category

```
INPUT: "thẻ nào tốt nhất cho {category}?"

Bước 1: Normalize category input
  - Map từ khóa người dùng → category_code (Section 3)
  - Ví dụ: "bảo hiểm" → insurance, "ăn uống" → dining_out

Bước 2: Lookup Section 4 (Category → Best Account)
  - Tìm row với category_code match
  - Extract: best_account_1, cashback_rate_1, condition_1

Bước 3: Check điều kiện áp dụng
  - Nếu có spend threshold → giải thích rõ
  - Nếu có cap → ghi rõ max amount

Bước 4: Trả lời
Format:
"🏆 Thẻ tốt nhất cho {category_name_vi}:
   • {account_name_1}: {cashback_rate_1}
   • Điều kiện: {condition_1}
   
   🥈 Lựa chọn thứ 2 (nếu có):
   • {account_name_2}: {cashback_rate_2}
   • Điều kiện: {condition_2}
   
   💡 Ghi chú: {notes}"

Nếu data chưa đầy đủ (TODO):
"⚠️ Hiện tại chưa có dữ liệu chính xác cho category này.
   Bạn có thể tham khảo các thẻ phổ biến:
   • VPBank Lady: tốt cho bảo hiểm
   • VIB Super: tốt cho mua sắm online
   • UOB ONE: tốt cho ăn uống, siêu thị"

Ví dụ:
Input: "thẻ nào tốt nhất cho mua bảo hiểm?"
Output:
"🏆 Thẻ tốt nhất cho Bảo hiểm:
   • VPBank Lady Card: 15% cashback
   • Điều kiện: Chi ≥ 15M/kỳ, max 300k/kỳ
                Chi < 15M/kỳ: 7.5% max 100k
   
   💡 Ghi chú: VPBank Lady vô địch category này, 
   không thẻ nào match được tỷ lệ 15%"
```

### Template 3: Tính Cashback Projection

```
INPUT: "tôi đã chi {spent_amount} cho {category} bằng {account}, 
        thêm {extra_amount} nữa thì back bao nhiêu?"

Bước 1: Resolve inputs
  - account_code ← lookup Section 2
  - category_code ← lookup Section 3
  - spent_amount ← parse số (triệu → triệu VND)
  - extra_amount ← parse số

Bước 2: Lookup cashback_policy của account (từ accounts.md)
  - applicable_categories: category này có được tính không?
  - cb_percent: tỷ lệ %
  - cb_max_budget: trần tối đa
  - cb_min_spend: ngưỡng tối thiểu (nếu có)
  - cycle_type: calendar_month hay statement_cycle

Bước 3: Tính total_spent = spent_amount + extra_amount

Bước 4: Check tier conditions (nếu có nhiều tiers)
  - Ví dụ VPBank Lady:
    Tier 1: spend < 15M → 7.5% max 100k
    Tier 2: spend ≥ 15M → 15% max 300k

Bước 5: Tính cashback
  - earned_on_spent = min(spent_amount * rate, cap)
  - earned_on_total = min(total_spent * rate, cap)
  - additional_cashback = earned_on_total - earned_on_spent
  
  HOẶC nếu có clawback do xuống tier:
  - Recalculate toàn bộ theo tier mới

Bước 6: Trả lời
Format:
"💰 Dự báo cashback cho {category_name_vi}:

   Hiện tại:
   • Đã chi: {spent_amount}
   • Cashback đã earned: {earned_on_spent}
   
   Sau khi chi thêm {extra_amount}:
   • Tổng chi: {total_spent}
   • Tier áp dụng: {tier_name}
   • Cashback mới: {earned_on_total}
   • ➕ Thêm được: {additional_cashback}
   
   ⚠️ Lưu ý: {warnings nếu có}"

Ví dụ:
Input: "đã chi 14.9tr bảo hiểm bằng vpbank lady, 
        mua thêm 5tr nữa thì back bao nhiêu?"
Output:
"💰 Dự báo cashback cho Bảo hiểm (VPBank Lady):

   Hiện tại:
   • Đã chi: 14.900.000đ
   • Tier: 7.5% (dưới 15M)
   • Cashback đã earned: 1.117.500đ (nhưng max 100k)
   → Thực nhận: 100.000đ
   
   Sau khi chi thêm 5.000.000đ:
   • Tổng chi: 19.900.000đ
   • Tier: 15% (≥ 15M)
   • Cashback mới: min(19.9M * 15%, 300k) = 300.000đ
   • ➕ Thêm được: 300k - 100k = 200.000đ
   
   ⚠️ Lưu ý: Bạn cần chi thêm ít nhất 100k để đạt ngưỡng 15M
   và unlock tier 15%!"
```

---

## 8. Checklist cho Agent/Codegen

- [ ] Đọc Section 2 để resolve account từ keyword
- [ ] Đọc Section 3 để resolve category từ keyword
- [ ] Áp dụng Section 5 cho ambiguous cases
- [ ] Áp dụng Section 6 cho conflict resolution
- [ ] Dùng Section 4 để tư vấn thẻ theo category
- [ ] Dùng Template 1-7 để parse transaction
- [ ] Dùng Template 2 để trả lời câu hỏi tư vấn
- [ ] Dùng Template 3 để tính cashback projection
- [ ] Nếu gặp TODO trong Section 4 → cảnh báo user là data chưa đầy đủ
- [ ] Luôn output confidence level (high/medium/low)
- [ ] Nếu confidence = low → đề nghị user confirm manually

---

## 9. Maintenance Notes

### Cập nhật file này khi:

1. **Thêm thẻ tín dụng mới**
   - Thêm row vào Section 2
   - Update Section 4 nếu thẻ có cashback đặc biệt cho category nào đó

2. **Thêm merchant phổ biến mới**
   - Thêm row vào Section 3
   - Đảm bảo map đúng category_code từ master list

3. **Cashback policy thay đổi**
   - Update Section 4 với rates/conditions mới
   - Ghi chú ngày thay đổi

4. **Phát hiện ambiguous case mới**
   - Thêm rule vào Section 5

### Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-XX | Initial version |
