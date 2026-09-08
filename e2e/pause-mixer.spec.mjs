import { expect, test } from '@playwright/test';

for (const viewport of [{width:390,height:844},{width:844,height:390},{width:1440,height:1000}]) {
  test(`pause mixer and Help dismissal stay usable at ${viewport.width}x${viewport.height}`, async ({page,browserName}) => {
    test.skip(browserName !== 'chromium', 'Channel hit geometry is covered once in Chromium.');
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      const profile={version:7,wins:0,firstOrbit:{seen:true,completed:true},secondOrbit:{seen:true,completed:true}};
      for(const key of ['constellore-profile-v1','constellore-local-profile-v1']) localStorage.setItem(key,JSON.stringify(profile));
    });
    await page.goto('/play/?challenge=1&target=Telescope&seed=73&birthday=off');
    await expect(page.locator('#missionBriefingDialog')).toHaveJSProperty('open',true);
    await page.locator('#beginMission').click();
    await expect(page.locator('#board')).toBeVisible();
    await page.locator('#pauseRunButton').click();
    await expect(page.locator('#pauseDialog')).toBeVisible();
    const mixer=page.locator('#pauseVolumeControl .vdet');
    const toggle=mixer.locator('summary');
    await expect(toggle.locator('b')).toBeVisible();
    await expect(toggle.locator('b')).toHaveText('Mixer');
    await toggle.click();
    await expect(mixer).toHaveAttribute('open','');
    for(const id of ['pauseMasterVolumePreference','pauseMusicVolumePreference','pauseSfxVolumePreference']) {
      const slider=page.locator(`#${id}`);
      await slider.scrollIntoViewIfNeeded();
      const before=Number(await slider.inputValue());
      const box=await slider.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(200);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x+box.width).toBeLessThanOrEqual(viewport.width+1);
      expect(box.y+box.height).toBeLessThanOrEqual(viewport.height+1);
      const hit=await slider.evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===el;});
      expect(hit,`${id} is not clipped or covered`).toBe(true);
      await slider.click({position:{x:box.width*.45,y:box.height/2}});
      await expect.poll(async()=>Number(await slider.inputValue())).not.toBe(before);
      const afterPointer=Number(await slider.inputValue());
      await slider.focus();
      await page.keyboard.press('ArrowRight');
      await expect.poll(async()=>Number(await slider.inputValue())).toBeCloseTo(afterPointer+.05,2);
    }
    await mixer.locator('.vpanel').scrollIntoViewIfNeeded();
    await page.screenshot({path:`.tmp-codex-build/game-continuation/dialogs/${viewport.width}-pause-mixer-after.jpg`,quality:88});
    await page.keyboard.press('Escape');
    await expect(page.locator('#pauseDialog')).toBeHidden();
    await expect(page.locator('#pauseRunButton')).toBeFocused();
    await expect(page.locator('#board')).toBeVisible();
    await page.locator('#mobileAssistToggle').click();
    await page.locator('#senseButton').click();
    await expect(page.locator('#senseDialog')).toBeVisible();
    await page.locator('#revealPathButton').click();
    await expect(page.locator('#revealDialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#revealDialog')).toBeHidden();
    await expect(page.locator('#senseDialog')).toBeHidden();
    await expect(page.locator('#mobileAssistToggle')).toBeFocused();
    await page.screenshot({path:`.tmp-codex-build/game-continuation/dialogs/${viewport.width}-reveal-dismiss-after.jpg`,quality:88});
  });
}
