# Requirements: PDF reader

> **Documented after the build.** PDF upload was built outside Kiro, in commit "Read PDF leases in the browser and close the open reader tasks". This spec was written afterwards from the code and its tests, so the spec set covers what the app does. It is not a spec-first plan; criteria name the tests that already hold them.

## Introduction
Most renters have their lease as a PDF from a property manager, not as plain text. Lease Lawyer reads the PDF's text layer in the browser, turns it into lease text with whole sentences, and hands it to the same parser, reader, verifier and coverage check as any other lease. Nothing is uploaded. A PDF it cannot read is refused with a reason; it never produces a partial lease that could make the lease look silent.

## Glossary
- **Text layer**: the selectable text a PDF carries. A scan has none.
- **Run**: one positioned piece of text on a page, as pdf.js reports it (`str`, baseline `y`, font height, end-of-line flag).
- **Reflow**: joining the lines of one paragraph with a space, so a sentence wrapped across lines becomes one sentence again.

Criteria use the EARS form of the proof-chain spec.

## Requirement 1: Read a PDF lease in the browser
**User story:** As a renter, I want to upload the PDF my landlord sent, so that I do not have to copy its text by hand.

1.1 WHEN the renter uploads a file whose name ends in `.pdf` or whose type is `application/pdf` THE SYSTEM SHALL read its text layer in the browser with pdf.js.
1.2 THE SYSTEM SHALL load pdf.js only when a PDF is chosen.
1.3 THE SYSTEM SHALL not send the PDF or its text to any server.
1.4 WHEN a PDF has been read THE SYSTEM SHALL treat its text exactly like an uploaded text file.
1.5 WHILE a PDF is being read THE SYSTEM SHALL show "Reading PDF…" on the upload button and disable it.

## Requirement 2: Keep sentences whole so quotes stay verbatim
**User story:** As a renter, I want quotes from my PDF to match its words, so that every cited step can be checked.

2.1 THE SYSTEM SHALL join runs that share a baseline into one line.
2.2 THE SYSTEM SHALL join consecutive lines of one paragraph with a single space.
2.3 WHEN the gap between two lines is clearly wider than the page's usual line spacing THE SYSTEM SHALL start a new paragraph.
2.4 WHEN a line starts with a numbered heading such as `6. SECURITY DEPOSIT.` THE SYSTEM SHALL start a new paragraph.
2.5 WHEN a new page starts THE SYSTEM SHALL start a new paragraph.
2.6 WHEN the sample lease PDF is read THE SYSTEM SHALL extract exactly the facts of its plain-text version, with no rejected and no unread entries.

## Requirement 3: Refuse what cannot be read, and say why
**User story:** As a renter, I want to know when my PDF could not be read, so that I never get an answer built on half a lease.

3.1 IF a PDF has no text layer THEN THE SYSTEM SHALL refuse it, give the page count, and suggest pasting the text.
3.2 IF a PDF cannot be opened THEN THE SYSTEM SHALL refuse it and say it may be damaged or password-protected.
3.3 IF a PDF file is larger than 5 MB THEN THE SYSTEM SHALL refuse it before reading it.
3.4 IF the text of a PDF is larger than 200 KB THEN THE SYSTEM SHALL refuse it rather than cut it short.
3.5 IF a PDF is refused THEN THE SYSTEM SHALL keep the current lease loaded.

## Requirement 4: A sample PDF to try
**User story:** As a visitor without a lease to hand, I want a sample PDF, so that I can try the upload path.

4.1 THE SYSTEM SHALL offer a sample lease PDF for download from the "Your own" case file.
4.2 THE SYSTEM SHALL generate the sample PDF from a sample lease's text with real, selectable text.
