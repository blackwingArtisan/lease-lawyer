# Tasks: PDF reader

> **Documented after the build.** These tasks record work already done outside Kiro; each is checked only where code and a test exist. Open tasks are real gaps.

- [x] 1. Read the PDF text layer in the browser with pdf.js, loaded on demand (Req 1.1, 1.2, 1.4)
  - [x] 1.1 End-to-end: upload the sample PDF, read 13 facts, ask about the deposit and check the cited quote (Req 1.1, 1.4)
- [x] 2. Join runs into lines and reflow lines into paragraphs (Req 2.1-2.5)
  - [x] 2.1 Unit tests: wrapped sentence, wider gap, numbered heading, runs on one line, page break, empty page (Req 2.1-2.5)
  - [x] 2.2 Unit test: the sample PDF reads to the same facts as its text, with no rejected and no unread entries (Req 2.6)
- [x] 3. Refuse unreadable PDFs with a reason and keep the current lease (Req 3.2, 3.5)
  - [x] 3.1 End-to-end: a damaged PDF is refused and the current lease stays (Req 3.2, 3.5)
- [ ] 4. Test the remaining refusals (Req 3.1, 3.3, 3.4). The code exists in `CaseFiles`; no test uploads a scan-like PDF with no text, a PDF over 5 MB, or a PDF whose text is over 200 KB.
- [x] 5. Offer a generated sample PDF for download (Req 4.1, 4.2)
  - [x] 5.1 End-to-end: the sample PDF link returns a PDF (Req 4.1)
- [ ] 6. Test that reading a PDF makes no network request beyond the app's own assets (Req 1.3)
- [ ] 7. Test the "Reading PDF…" busy state (Req 1.5)
