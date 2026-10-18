import assert from 'node:assert/strict';

// Bounded text check on computed CSS colors. Gradient stop bounds are conservative;
// this does not inspect every pixel, image, pseudo-element, state or WCAG criterion.
export async function assertBasicTextContrast(page, selectors) {
  const results = [];
  for (const selector of selectors) {
    const element = page.locator(selector).first();
    await element.scrollIntoViewIfNeeded();
    await element.evaluate(async (node) => {
      for (let parent = node; parent; parent = parent.parentElement) {
        await Promise.all(parent.getAnimations().map((animation) => animation.finished));
      }
    });
    const sample = await element.evaluate((node) => {
      const rgba = (text) => {
        const values = text.match(/[\d.]+/gu)?.map(Number);
        if (!/^rgba?\(/u.test(text) || values.length < 3) throw new Error('Unsupported computed contrast color');
        return [...values.slice(0, 3), values[3] ?? 1];
      };
      const blend = (front, back) => back.map((value, index) => front[index] * front[3] + value * (1 - front[3]));
      let low = [255, 255, 255];
      let high = [...low];
      const ancestors = [];
      for (let parent = node; parent; parent = parent.parentElement) ancestors.unshift(parent);
      for (const parent of ancestors) {
        const style = getComputedStyle(parent);
        if (Number(style.opacity) < 0.999) throw new Error('Contrast sample has unsettled or translucent ancestor');
        const base = rgba(style.backgroundColor);
        low = blend(base, low); high = blend(base, high);
        if (style.backgroundImage !== 'none' && !/gradient\(/u.test(style.backgroundImage)) throw new Error('Contrast sample has an unsupported image background');
        for (const stop of style.backgroundImage.match(/rgba?\([^)]+\)/gu) ?? []) {
          const color = rgba(stop);
          const lower = blend(color, low); const upper = blend(color, high);
          low = low.map((value, index) => Math.min(value, lower[index]));
          high = high.map((value, index) => Math.max(value, upper[index]));
        }
      }
      const foreground = rgba(getComputedStyle(node).color);
      if (foreground[3] !== 1) throw new Error('Contrast sample has translucent text');
      return { foreground: foreground.slice(0, 3), low, high };
    });
    const luminance = (rgb) => rgb.map((value) => value / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const foreground = luminance(sample.foreground);
    const bounds = [luminance(sample.low), luminance(sample.high)];
    const ratios = bounds.map((background) => (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05));
    const ratio = foreground >= bounds[0] && foreground <= bounds[1] ? 1 : Math.min(...ratios);
    assert.ok(ratio >= 4.5, `${selector}: bounded text contrast ${ratio.toFixed(2)} < 4.5`);
    results.push({ selector, ...sample, minimumRatio: ratio });
  }
  return results;
}
