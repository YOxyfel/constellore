import { test, expect } from '@playwright/test';

for (const viewport of [{width:1440,height:1000},{width:1005,height:700},{width:390,height:844},{width:844,height:390}]) {
  test(`Home navigation cannot cover the first lesson at ${viewport.width}x${viewport.height}`, async ({page}) => {
    await page.setViewportSize(viewport);
    await page.goto('/play/?birthday=off');
    const home = page.locator('#homePlaySplit');
    await expect(home).toHaveAttribute('data-home-hub-phase','ready');
    const card = page.locator('#homeOrbitForge');
    await expect(card).toBeVisible();
    await expect(card.locator('h2')).toBeVisible();
    await expect(card.locator('#primaryOrbitButton')).toBeVisible();
    await expect(card.locator('#primaryOrbitButton')).toHaveText(/Start playing/);
    await expect(card.locator('#primaryOrbitKicker')).toHaveText('Your first discovery');
    await expect(card.locator('#primaryOrbitDescription')).toHaveText('Combine Earth and Water to discover your first word.');
    await expect(page.locator('#homeOrbitTabForge')).toHaveText(/Play/);
    const toggle = page.locator('[data-planet-hub-places-toggle]');
    const panel = page.locator('[data-planet-hub-places]');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded','false');
    await expect(panel).toBeHidden();
    const blockers = ['.planet-hub-places__toggle','[data-planet-hub-zoom-rail]'];
    const checks = await card.evaluate((element, blockers) => {
      const rect = element.getBoundingClientRect();
      const overlaps = blockers.filter(selector => {
        const other = document.querySelector(selector);
        if (!other || other.hidden) return false;
        const box = other.getBoundingClientRect();
        return box.width && box.height && Math.min(rect.right,box.right)>Math.max(rect.left,box.left) && Math.min(rect.bottom,box.bottom)>Math.max(rect.top,box.top);
      });
      const visibleText = [...element.querySelectorAll('.primary-orbit-kicker,h2,#primaryOrbitButton')].every(control => {
        const box = control.getBoundingClientRect();
        if (!box.width || !box.height) return true; // Optional kicker is hidden on short landscape.
        const hit = document.elementFromPoint(box.left+box.width/2,box.top+box.height/2);
        return control === hit || control.contains(hit);
      });
      return { overlaps, visibleText };
    }, blockers);
    expect(checks.overlaps).toEqual([]);
    expect(checks.visibleText).toBe(true);
    // The celestial directory is optional at every viewport. Opening it moves
    // focus to search; Escape restores the exact trigger and playable Home.
    await toggle.click();
    await expect(panel).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded','true');
    await expect(page.locator('[data-planet-hub-places-search]')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(toggle).toBeFocused();
    await page.locator('#primaryOrbitButton').click();
    await expect(page.locator('#missionBriefingDialog')).not.toBeVisible();
    await expect(page.locator('#firstOrbitGuide')).toBeVisible();
    await expect(page.locator('#board')).toBeVisible();
  });
}

for (const viewport of [{width:1440,height:1000},{width:390,height:844},{width:844,height:390}]) {
  test(`Practice banner leaves navigation and lesson clear at ${viewport.width}x${viewport.height}`, async ({page}) => {
    await page.setViewportSize(viewport);
    await page.goto('/play/?birthday=off');
    await expect(page.locator('#homePlaySplit')).toHaveAttribute('data-home-hub-phase','ready');
    // Match the release banner without switching the source server's data runtime.
    await page.evaluate(() => {
      const banner = document.createElement('div');
      banner.className = 'practice-banner';
      banner.innerHTML = '<a href="/">Website</a><span class="practice-banner__status"><strong>Local practice</strong></span>';
      document.querySelector('#startScreen').prepend(banner);
    });
    const geometry = await page.evaluate(() => {
      const rect = selector => document.querySelector(selector).getBoundingClientRect();
      const nav = rect('.start-nav');
      const places = rect('.planet-hub-places__toggle');
      const controls = rect('[data-planet-hub-zoom-rail]');
      const card = rect('#homeOrbitForge');
      const intersects = (a,b) => Math.min(a.right,b.right)>Math.max(a.left,b.left) && Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top);
      return { navBottom:nav.bottom, placesTop:places.top, zoomTop:controls.top, cardBlocked:intersects(card,controls)||intersects(card,places) };
    });
    expect(geometry.placesTop).toBeGreaterThanOrEqual(geometry.navBottom);
    expect(geometry.zoomTop).toBeGreaterThanOrEqual(geometry.navBottom);
    expect(geometry.cardBlocked).toBe(false);
  });
}
