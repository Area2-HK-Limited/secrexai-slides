const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function screenshotSlides() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 768 });

  const filePath = path.resolve(__dirname, 'index.html');
  await page.goto('file://' + filePath);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);

  // Count slides
  const slideCount = await page.locator('.slide').count();
  console.log(`Total slides found: ${slideCount}`);

  // Get data-slide for each slide
  const slides = await page.locator('.slide').evaluateAll(els =>
    els.map((el, i) => ({
      index: i,
      dataSlide: el.getAttribute('data-slide'),
      classList: el.className
    }))
  );
  slides.forEach(s => console.log(`Slide ${s.index}: data-slide=${s.dataSlide}, class=${s.classList}`));

  const outDir = path.resolve(__dirname, 'screenshots');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  for (const entry of fs.readdirSync(outDir)) {
    if (entry.endsWith('.png') || entry === 'report.json') {
      fs.rmSync(path.join(outDir, entry), { force: true });
    }
  }

  const report = [];

  for (let i = 0; i < slideCount; i++) {
    try {
      if (i > 0) {
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(850);
      }

      const counter = (await page.locator('#counter').textContent()).trim();
      const activeSlide = page.locator('.slide.active');
      const metrics = await activeSlide.evaluate((slide) => {
        const rect = slide.getBoundingClientRect();
        const overflowingY = slide.scrollHeight > slide.clientHeight + 1;
        const overflowingX = slide.scrollWidth > slide.clientWidth + 1;
        const textLength = (slide.innerText || '').trim().length;
        const descendants = Array.from(slide.querySelectorAll('*'));
        const outOfBounds = descendants.filter((node) => {
          const bounds = node.getBoundingClientRect();
          return bounds.bottom > rect.bottom + 1 || bounds.right > rect.right + 1;
        }).length;

        return {
          dataSlide: slide.getAttribute('data-slide'),
          className: slide.className,
          clientHeight: slide.clientHeight,
          scrollHeight: slide.scrollHeight,
          clientWidth: slide.clientWidth,
          scrollWidth: slide.scrollWidth,
          overflowingY,
          overflowingX,
          textLength,
          outOfBounds,
        };
      });

      const fileName = `slide_${String(i + 1).padStart(2, '0')}_${counter.replace(/\//g, '-').replace(/\s/g, '')}.png`;
      await page.screenshot({
        path: path.join(outDir, fileName),
        clip: { x: 0, y: 0, width: 1280, height: 768 }
      });

      report.push({
        fileName,
        counter,
        ...metrics,
      });

      console.log(`Screenshot: ${fileName}`);
      if (metrics.overflowingY || metrics.overflowingX || metrics.textLength === 0 || metrics.outOfBounds > 0) {
        console.log(`  Flagged: overflowY=${metrics.overflowingY} overflowX=${metrics.overflowingX} textLength=${metrics.textLength} outOfBounds=${metrics.outOfBounds}`);
      }
    } catch(e) {
      console.error(`Error on slide ${i}: ${e.message}`);
    }
  }

  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`Report written: ${path.join(outDir, 'report.json')}`);

  await browser.close();
}

screenshotSlides().catch(console.error);
