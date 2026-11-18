// Adds DOM matchers such as toBeInTheDocument / toHaveAttribute to expect().
import "@testing-library/jest-dom";

// jsdom doesn't implement Blob#text() (every real browser does); the roster
// parser reads uploaded CSVs with it. Polyfill via FileReader, which jsdom has.
if (typeof Blob !== "undefined" && !Blob.prototype.text) {
  Blob.prototype.text = function text(this: Blob) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}
