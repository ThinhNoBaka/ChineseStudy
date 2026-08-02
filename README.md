# ChineseStudy 学中文

Ứng dụng web học từ vựng tiếng Trung, chạy **hoàn toàn trong trình duyệt** —
không server, không database. Bạn chỉ cần tải lên một file Excel, phần còn
lại được xử lý tự động: hiển thị flashcard, chấm điểm, và một thuật toán lặp
lại ngắt quãng (spaced repetition) kiểu Anki quyết định từ nào cần ôn lại và
khi nào.

---

## 1. Cài đặt & chạy thử cục bộ

Không cần cài `npm install` gì cả — dự án chỉ dùng HTML/CSS/JavaScript
thuần và một thư viện CDN duy nhất (SheetJS để đọc Excel).

Vì trình duyệt chặn `import` module khi mở file bằng `file://`, bạn cần một
local server đơn giản:

```bash
# Cách 1 — Python (có sẵn trên hầu hết máy)
cd ChineseStudy
python3 -m http.server 8000

# Cách 2 — Node
npx serve .

# Cách 3 — VS Code
# Cài extension "Live Server" rồi bấm "Go Live"
```

Sau đó mở trình duyệt tại `http://localhost:8000`.

---

## 2. Cách tải file Excel

File Excel (`.xlsx`, `.xls`) hoặc `.csv` luôn có đúng 3 cột, **không quan
trọng tên cột / có header hay không**:

| Cột A (Chữ Hán) | Cột B (Pinyin) | Cột C (Nghĩa tiếng Việt) |
|---|---|---|
| 邮局 | yóujú | Bưu điện |
| 银行 | yínháng | Ngân hàng |
| 橘子 | júzi | Cam |

Ứng dụng tự động bỏ qua dòng tiêu đề (dòng không chứa ký tự Hán ở cột A) và
đọc mọi dòng còn lại. Kéo thả file vào ô upload hoặc bấm để chọn file.

**Nhiều bài học trong 1 file:** nếu file Excel của bạn có nhiều trang tính
(sheet) — mỗi sheet đặt tên "Bài 1", "Bài 2"... — ứng dụng sẽ tự nhận
mỗi sheet là **một bài học riêng**. Khi mở bộ từ đó lên, bạn sẽ được hỏi
muốn học bài nào (hoặc "🔀 Tất cả các bài" để gộp hết lại). Sheet trống
sẽ tự động bị bỏ qua.

**Một từ có nhiều nghĩa:** nếu cột C có nhiều nghĩa tiếng Việt cho cùng
một từ, hãy cách nhau bằng dấu `/`, `,` hoặc `;` — ví dụ `Ngân hàng /
Nhà băng`. Khi học ở chế độ Hán → Việt, chỉ cần gõ đúng **một trong các
nghĩa** đó là được tính chính xác.

---

## 3. Kiến trúc dự án

```
ChineseStudy/
├── index.html          # Toàn bộ cấu trúc màn hình (upload / quiz / summary / settings)
├── style.css            # Design system, dark mode, responsive
├── app.js                # Điểm khởi động — nối các module lại với nhau
├── README.md
└── js/
    ├── storage.js        # Lớp bọc localStorage, hỗ trợ nhiều "deck" (bộ từ)
    ├── excel.js           # Đọc file Excel bằng SheetJS -> mảng từ vựng
    ├── quiz.js             # Bộ máy phiên học + thuật toán lặp lại ngắt quãng
    ├── settings.js         # Cấu hình người dùng (mode, shuffle, dark mode...)
    ├── review.js            # Danh sách từ sai / từ đánh dấu sao (theo từng deck)
    ├── pinyin.js             # Chuẩn hóa pinyin + tìm chữ Hán theo pinyin
    ├── handwriting.js        # Bảng vẽ luyện viết tay (canvas)
    └── ui.js                  # Toàn bộ thao tác DOM (render màn hình)
```

**Nguyên tắc phân chia:** `app.js` không tự vẽ giao diện và không tự lưu
trữ dữ liệu — nó chỉ điều phối. Mọi thao tác DOM nằm trong `ui.js`, mọi
đọc/ghi `localStorage` nằm trong `storage.js`.

### Mô tả từng module

- **`storage.js`** — API `get/set` có namespace, tất cả key đều bắt đầu
  bằng `chinesestudy:`. Từ bản có tính năng lịch sử, mỗi file Excel được
  tải lên trở thành một **deck** độc lập với id riêng
  (`chinesestudy:deck:<id>:vocab|session|starred|wrong`), và một danh
  sách `chinesestudy:decks` lưu metadata (tên, số từ, ngày tạo) để hiển
  thị lịch sử. Có migration tự động cho người đã dùng bản cũ (chỉ có 1
  bộ từ duy nhất).

- **`excel.js`** — Dùng SheetJS đọc file thành mảng `array-of-arrays`, lọc
  bỏ dòng trống hoặc dòng tiêu đề (dựa trên việc cột A có ký tự CJK hay
  không), rồi gán id ổn định cho từng từ.

- **`quiz.js`** — Lớp `QuizSession` quản lý một hàng đợi (`queue`) các id
  từ vựng:
  - Trả lời đúng ngay lần đầu → từ đạt trạng thái **Mastered**, bị loại
    khỏi hàng đợi vĩnh viễn.
  - Trả lời sai → từ vẫn ở trạng thái **Learning**, được chèn lại vào hàng
    đợi ở một vị trí cách vị trí hiện tại một khoảng ngẫu nhiên (xa hơn ở
    lần sai đầu tiên — mặc định 5–8 câu, gần hơn ở lần sai tiếp theo —
    mặc định 3–5 câu, có thể chỉnh trong Cài đặt).
  - Không lặp lại đúng từ vừa hỏi ở câu ngay sau đó, trừ khi không còn từ
    nào khác trong hàng đợi.
  - Phiên học chỉ kết thúc khi hàng đợi rỗng, nghĩa là **mọi từ đã được
    trả lời đúng**.
  - `serialize()` / khởi tạo với `restore` cho phép lưu và khôi phục
    nguyên trạng một phiên học đang dang dở sau khi tải lại trang.
  - `checkAnswer()` chấp nhận nhiều nghĩa tiếng Việt cách nhau bằng
    `/`, `,`, `;` trong cùng một ô — chỉ cần đúng 1 nghĩa là được tính
    chính xác.

- **`settings.js`** — Nắm giữ cấu hình hiện tại trong bộ nhớ + đồng bộ với
  `storage.js`. Cung cấp `firstMissDelayRange()` / `repeatMissDelayRange()`
  để `quiz.js` biết khoảng cách chèn lại từ sai theo cấu hình người dùng.

- **`review.js`** — Quản lý hai danh sách phụ theo từng deck: từ đã từng
  trả lời sai (`wrong`) và từ được đánh dấu sao (`starred`). Cũng lưu
  thống kê tổng số phiên đã hoàn thành (chung cho mọi deck).

- **`pinyin.js`** — Chuẩn hóa pinyin có dấu thanh (`yóujú` → `youju`) và
  tìm trong bộ từ đang học những từ có pinyin khớp với chuỗi người dùng
  gõ, phục vụ bàn phím Pinyin.

- **`handwriting.js`** — Gắn sự kiện vẽ (chuột/cảm ứng) lên một
  `<canvas>` để làm bảng luyện viết tay. Không xử lý nhận diện ký tự.

- **`ui.js`** — Toàn bộ hàm `render*` và các tham chiếu DOM. Không chứa
  logic nghiệp vụ — chỉ nhận dữ liệu và vẽ ra màn hình.

- **`app.js`** — Lắng nghe sự kiện người dùng (upload, chọn deck, check,
  next, đổi cài đặt...) và gọi đúng hàm ở các module trên theo đúng thứ
  tự.

---

## 4. Các tính năng chính

- **2 chế độ học:** Hán → Việt và Việt → Hán, đổi bất cứ lúc nào trong
  phần Cài đặt.
- **Chấm điểm thông minh:** bỏ khoảng trắng thừa, tiếng Việt không phân
  biệt hoa/thường, tiếng Trung phải khớp chính xác từng ký tự.
- **Lặp lại ngắt quãng kiểu Anki** (xem chi tiết ở mục kiến trúc).
- **Đánh dấu từ khó (⭐)** và học riêng nhóm từ đã đánh dấu.
- **Ôn lại từ sai** — cả trong lúc học (tự động quay lại) lẫn sau khi kết
  thúc phiên (nút "Học lại từ sai" ở màn hình tổng kết).
- **Tổng kết chi tiết:** tổng số từ, số câu đúng ngay lần đầu, số câu sai,
  độ chính xác, thời gian học, thời gian phản hồi trung bình, tổng số
  lượt ôn.
- **Lưu tiến độ tự động** — tải lại trang giữa chừng không mất tiến độ.
- **Lịch sử nhiều file đã tải** — mỗi lần tải Excel tạo một "bộ từ" (deck)
  riêng, xem lại và học tiếp bất kỳ bộ nào ở màn hình chính, tiến độ /
  từ sai / từ đánh dấu sao của mỗi bộ hoàn toàn tách biệt.
- **Bàn phím Pinyin & bảng viết tay** (khi học chiều Việt → Hán) — xem
  chi tiết ở mục 8 bên dưới.
- **Responsive & mobile-first**, bàn phím ảo không che input nhờ
  `env(safe-area-inset-bottom)`.
- **Hỗ trợ bàn phím:** `Enter` để kiểm tra, `Enter` lần nữa để sang câu
  tiếp theo.
- **Dark mode** cùng toàn bộ bảng màu riêng.

---

## 5. Bàn phím Pinyin & bảng viết tay

Khi học chiều **Việt → Hán**, bạn phải gõ ra chữ Hán — nếu máy chưa cài
bộ gõ tiếng Trung, phía dưới ô trả lời sẽ có 2 nút hỗ trợ:

- **拼 Bàn phím Pinyin** — gõ pinyin không dấu (vd `yiyuan`), ứng dụng sẽ
  tìm trong **đúng bộ từ bạn đang học** những từ có pinyin khớp và hiện
  ra để bấm chọn, tự động điền chữ Hán vào ô trả lời. Vì tìm trong bộ từ
  đã biết trước (không phải từ điển pinyin→hán tổng quát), kết quả luôn
  chính xác cho đúng bài đang học.

- **✍ Tập viết tay** — một bảng vẽ để luyện nhớ mặt chữ bằng chuột/tay
  cảm ứng. **Đây không phải nhận diện chữ viết tay (OCR)** — biến nét vẽ
  thành văn bản đòi hỏi một mô hình AI riêng và thường cần server, nằm
  ngoài phạm vi "không backend" của dự án này. Bảng vẽ chỉ giúp bạn luyện
  tập trí nhớ cơ (muscle memory) trước khi gõ đáp án ở ô phía trên hoặc
  dùng bàn phím Pinyin.

---

## 6. Deploy lên GitHub Pages

```bash
# 1. Tạo repo và push code
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin main

# 2. Vào Settings → Pages trên GitHub
#    Chọn branch "main", thư mục "/ (root)", bấm Save
```

Sau vài phút trang sẽ có mặt tại:
`https://<username>.github.io/<repo>/`

Vì dự án không có bước build nào, không cần workflow CI/CD gì thêm.

---

## 7. Tùy biến

- **Đổi bảng màu / font:** sửa các biến CSS ở đầu `style.css` (khối
  `:root` cho light mode, `[data-theme="dark"]` cho dark mode).
- **Đổi khoảng cách lặp lại mặc định:** sửa `DEFAULT_SETTINGS.reviewDelay`
  và các bảng `map` trong `firstMissDelayRange()` /
  `repeatMissDelayRange()` ở `settings.js`.
- **Thêm ngôn ngữ giao diện khác:** toàn bộ chuỗi văn bản tiếng Việt nằm
  trực tiếp trong `index.html` và `ui.js` — có thể tách ra một file
  `i18n.js` nếu cần đa ngôn ngữ.

---

## 8. Giới hạn hiệu năng đã kiểm tra

Đã thử với file Excel 1000+ từ: parse, xáo trộn và chạy toàn bộ thuật toán
lặp lại ngắt quãng mượt mà vì:
- `QuizSession` chỉ thao tác trên một mảng id (không phải object đầy đủ)
  nên chèn/xóa trong hàng đợi rất rẻ.
- DOM chỉ vẽ lại đúng phần thẻ từ đang hiển thị (`renderCard`), không bao
  giờ render lại toàn bộ danh sách từ vựng cùng lúc.
