const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function screenshotSlides() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 768 });

  const filePath = path.resolve(__dirname, 'index.html');
  await page.goto('file://' + filePath);
  await page.waitForTimeout(2000);

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

  // Screenshot each slide
  const outDir = path.resolve(__dirname, 'screenshots');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  for (let i = 0; i < slideCount; i++) {
    try {
      // Navigate to slide i using keyboard
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(800);

      const counter = await page.locator('#counter').textContent();
      const fileName = `slide_${String(i+1).padStart(2,'0')}_${counter.replace(/\//g,'-').replace(/\s/g,'')}.png`;
      await page.screenshot({
        path: path.join(outDir, fileName),
        clip: { x: 0, y: 0, width: 1280, height: 768 }
      });
      console.log(`Screenshot: ${fileName}`);
    } catch(e) {
      console.error(`Error on slide ${i}: ${e.message}`);
    }
  }

  await browser.close();
}

screenshotSlides().catch(console.error);
