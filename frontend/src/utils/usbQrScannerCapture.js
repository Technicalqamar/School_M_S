// HID keyboard QR scanner capture.
//
// A normal USB QR scanner presents itself to the operating system as a
// keyboard: decoding a QR code types the decoded value character-by-character
// at full speed, followed by an Enter keystroke (some drivers end the stream
// with a newline instead). This module captures exactly that keyboard stream
// and turns it into a single, normalized QR value.
//
// It deliberately knows nothing about attendance or QR formats — the produced
// value is passed through verbatim to the existing common QR attendance
// handler, so a USB scan resolves to the exact same Student/Teacher result as
// a camera scan of the same code.
export class UsbQrCapture {
  constructor({ onScan } = {}) {
    this.onScan = typeof onScan === 'function' ? onScan : () => {};
    this.buffer = '';
  }

  reset() {
    this.buffer = '';
  }

  // Process one keystroke from the (USB) scanner.
  // Returns true when the event was consumed as scanner input — including the
  // Enter terminator — so the caller can preventDefault/stopPropagation.
  handleKey({ key, repeat = false } = {}) {
    if (repeat) return true; // keyboard auto-repeat would inject garbage mid-scan

    if (typeof key !== 'string' || key === '') return false;

    if (key === 'Enter' || key === 'NumpadEnter') {
      this.flush();
      return true;
    }

    // Some HID scanner drivers report the terminator as 'Unidentified' on some
    // platforms. If we already buffered content, treat it as the scan end.
    if (key === 'Unidentified') {
      if (this.buffer) this.flush();
      return true;
    }

    if (key.length === 1) {
      this.buffer += key; // printable character emitted by the scanner
      return true;
    }

    return false; // control/metadata keys (Shift, Ctrl, Alt, Tab, ...)
  }

  // Complete the current scan and hand the normalized QR value to onScan.
  // Only scanner input is normalized here: a trailing Enter/newline or stray
  // whitespace is stripped before the value goes to the existing QR handler.
  flush() {
    const value = this.buffer.trim();
    this.buffer = '';
    if (!value) return;
    this.onScan(value);
  }
}