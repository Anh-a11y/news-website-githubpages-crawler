HUONG DAN CHAY DU AN TIN TUC 24H - LOCAL + GITHUB PAGES CRAWLER
================================================================

A. CHAY TREN MAY TINH
1. Cai Node.js 18 tro len.
2. Giai nen thu muc news-website-assignment.
3. Trong VS Code, mo dung thu muc co index.html va server.js.
4. Terminal > New Terminal, chay: node server.js
5. Mo http://localhost:3000
6. Crawler: http://localhost:3000/pages/crawler.html
7. Dung server: Ctrl+C trong Terminal.

B. DE LINK GITHUB PAGES CUNG CRAWL DUOC
GitHub Pages chi phuc vu file tinh. Crawler can API Node.js duoc host rieng.
Phai deploy server.js len Render (Web Service), sau do cho js/config.js biet URL Render.

1. Dam bao cac file nay nam o ROOT cua GitHub repository (cung cap voi index.html):
   server.js, package.json, render.yaml, index.html, js/, css/, pages/, categories.json, posts.json.
2. Commit/push cac file da cap nhat len repository dang publish GitHub Pages cua ban.
3. Dang nhap https://render.com/ va chon New -> Web Service.
4. Connect GitHub va chon repository website nay.
5. Neu source root la repo, dung cac gia tri:
   - Runtime: Node
   - Build Command: npm install
   - Start Command: npm start
   - Plan: Free (neu duoc cung cap)
6. Bam Create Web Service va cho deploy hoan tat. Render se cap URL dang:
   https://ten-dich-vu-cua-ban.onrender.com
7. Mo js/config.js va thay chuoi:
   https://YOUR-RENDER-SERVICE.onrender.com
   bang URL Render THẬT duoc cap. Vi du, neu Render cap
   https://news-website-crawler-api-abcd.onrender.com
   thi dat chinh xac URL do, khong them dau / o cuoi.
8. Commit/push js/config.js len GitHub. Cho GitHub Pages cap nhat.
9. Mo trang GitHub Pages:
   https://anh-a11y.github.io/news-website-assignment/pages/crawler.html
   roi thu crawl lai.
10. Kiem tra backend bang cach mo URL Render + /healthz. Ket qua mong doi:
   {"ok":true,"service":"news-website-crawler-api"}

C. NEU GITHUB PAGES VAN KHONG GOI DUOC API
- Kiem tra URL Render trong js/config.js co dung va bat dau bang https:// khong.
- Mo URL Render + /healthz de xem dich vu co song khong.
- Trong Render Logs, kiem tra dich vu da khoi dong thanh cong.
- Neu API bao CORS, kiem tra Origin cua trang la https://anh-a11y.github.io; backend nay da cho phep origin do mac dinh.
- Dich vu Render mien phi co the ngu khi khong duoc dung; yeu cau dau tien co the can cho may giay.
- Dan Tri co the tra HTTP 403/429 hoac CAPTCHA. CORS khong the vuot qua viec nguon chan crawler; khi do thu URL hop le khac hoac tuan thu co che truy cap cua website.

D. LUU Y DU LIEU
- posts.json ban dau co du lieu mau, khong phai 10 bai that/chuyen muc.
- Sau khi crawl thanh cong, bam Luu bai vao LocalStorage va Tai JSON de co ban sao.
- LocalStorage tren GitHub Pages va localhost la hai kho rieng biet.
- Crawler chi cho phep URL dantri.com.vn va subdomain, khong su dung nhu open proxy.
