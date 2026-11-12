import { test, expect } from '@playwright/test';

test('intro blur/fades once while the gallery flies in as a single transform/opacity surface', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const state = await page.evaluate(() => {
    const intro = document.querySelector('.home-page .intro');
    const gallery = document.querySelector('.hero > main');
    const read = element => {
      // Restart just these CSS arrivals so the assertions do not depend on how
      // quickly this machine finished downloading/decoding the first images.
      element.style.animation = 'none';
      void element.offsetWidth;
      element.style.removeProperty('animation');
      const animation = element.getAnimations()[0];
      animation.pause(); animation.currentTime = 200;
      return { name: animation.animationName, frames: animation.effect.getKeyframes() };
    };
    return { intro: read(intro), gallery: read(gallery), photoAnimations: [...document.querySelectorAll('.pile-image')].flatMap(image => image.getAnimations()).length };
  });
  expect(state.intro.name).toBe('intro-arrive');
  expect(state.intro.frames[0].filter).toBe('blur(6px)');
  expect(Number(state.intro.frames[0].opacity)).toBe(0);
  expect(state.gallery.name).toBe('gallery-arrive');
  expect(state.gallery.frames[0].transform).not.toBe(state.gallery.frames.at(-1).transform);
  expect(state.gallery.frames.every(frame => frame.filter === undefined)).toBe(true);
  expect(state.photoAnimations).toBe(0);
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) animation.finish();
  });
  await expect(page.locator('.home-page .intro')).toHaveCSS('filter', 'none');
  await expect(page.locator('.hero > main')).toHaveCSS('transform', 'none');
  await page.locator('#pile').click();
  await page.locator('#gallery').evaluate(element => Promise.allSettled(element.getAnimations({ subtree: true }).map(animation => animation.finished)));
  await expect(page.locator('.gallery-card.is-current')).toHaveCSS('will-change', 'auto');
  await page.locator('#next').click();
  await expect.poll(() => page.locator('#rail').evaluate(element => element.classList.contains('is-moving'))).toBe(false);
  await expect(page.locator('.gallery-card.is-current')).toHaveCSS('will-change', 'auto');
});

test('enabling reduced motion stops an in-flight intro and gallery entrance immediately', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.home-page .intro')).toHaveCSS('opacity', '1');
  await expect(page.locator('.home-page .intro')).toHaveCSS('filter', 'none');
  await expect(page.locator('.hero > main')).toHaveCSS('opacity', '1');
  await expect(page.locator('.hero > main')).toHaveCSS('transform', 'none');
  expect(await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length)).toBe(0);
});
