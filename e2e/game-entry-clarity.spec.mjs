import {test,expect} from '@playwright/test';
import {installSeenIntroFixture} from './intro-fixture.mjs';

test.beforeEach(async({page,request})=>{
  const response=await request.post('/api/player/register');expect(response.ok()).toBe(true);
  const registration=await response.json();
  const profile={version:10,wins:10,discovered:['Earth','Water','Fire','Air','Mud','Lava','Stone'],firstOrbit:{seen:true,completed:true},secondOrbit:{seen:true,completed:true},routeRank:{rank:'gold',challengeRank:'gold'},routeProgression:{version:2,masteryPoints:200,completedChallenges:10,failedChallenges:0,currentWinStreak:0,rankId:'gold',promotionTrial:null},playerId:registration.player.id,playerToken:registration.playerToken};
  const player={...registration.player,wins:profile.wins,discovered:profile.discovered,routeRank:profile.routeRank};
  await page.route('**/api/player',async route=>{
    if(route.request().method()==='GET')await route.fulfill({json:{player}});else await route.continue();
  });
  await page.route('**/api/player/restore',route=>route.fulfill({json:{player,entitlements:{products:[],vault:[]}}}));
  await installSeenIntroFixture(page,{resetStorage:true,localStorageEntries:[['constellore-profile-v1',JSON.stringify(profile)],['constellore-local-profile-v1',JSON.stringify(profile)]]});
});

test('free-play link opens its visible launch choice and explains persistent play',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/play/?mode=explore&birthday=off');
  const catalog=page.locator('#homeForgeCatalog');await expect(catalog).toBeVisible();
  const launch=catalog.locator('[data-mode="explore"]');await expect(launch).toBeFocused();await launch.click();
  await expect(page.locator('#missionBriefingDialog')).toBeVisible();
  await expect(page.locator('#missionBriefingTitle')).toHaveText('Free play',{useInnerText:true});
  await expect(page.locator('#missionBriefingVerb')).toBeHidden();
  await expect(page.locator('#missionBriefingRule')).toContainText('saved for your next visit');
  await page.locator('#beginMission').click();await expect(page.locator('#gameScreen')).toHaveClass(/explore-orbit/);
  await expect(page.locator('#mobileAssistToggle')).toBeHidden();await expect(page.locator('#routeStepCount')).toContainText('WORDS');
});

test('creator link opens and focuses the target chooser',async({page})=>{
  await page.goto('/play/?mode=creator&birthday=off');
  const chooser=page.locator('#exploreHub .custom-target-disclosure');
  await expect(page.locator('#homeForgeCatalog')).toBeVisible();
  await expect(chooser).toHaveJSProperty('open',true);await expect(chooser.locator('summary')).toBeFocused();
  await expect(chooser.locator('input')).toBeVisible();
});

for(const [mode,unit] of [['quick','seconds'],['moves','moves']]){
  test(`${mode} briefing states its limit before starting`,async({page})=>{
    await page.setViewportSize({width:320,height:568});
    // The isolated registered player is Bronze on the server. Supply the
    // unlocked mission variant for this UI contract without changing a save.
    await page.route('**/api/run/start',async route=>{
      expect(route.request().postDataJSON().mode).toBe(mode);
      const response=await route.fetch();const payload=await response.json();
      payload.game={...payload.game,mode,modeName:mode==='quick'?'Sprint':'Precision',timeLimit:mode==='quick'?120:null,moveLimit:mode==='moves'?10:null};
      await route.fulfill({response,json:payload});
    });
    await page.goto('/play/?birthday=off');
    await page.screenshot({path:`.tmp-codex-build/game-continuation/${mode}-home-320-after.jpg`,quality:85});
    await page.locator('#homeForgeCatalogToggle').click();
    await page.locator(`#modePicker [data-mode="${mode}"]`).click();
    await expect(page.locator('#missionBriefingDialog')).toBeVisible();
    const constraint=page.locator('#missionBriefingConstraint');await expect(constraint).toBeVisible();await expect(constraint).toContainText(new RegExp(`\\d+ ${unit}`));
    await page.screenshot({path:`.tmp-codex-build/game-continuation/${mode}-briefing-320-after.jpg`,quality:85});
    const button=page.locator('#beginMission');await expect(button).toBeVisible();
    const rect=await button.boundingBox();expect(rect.y+rect.height).toBeLessThanOrEqual(568);
    const guard=page.locator('#missionAdaptiveNote');if(await guard.isVisible())await expect(guard).toContainText('no move is used');
    await button.click();
    const counter=page.locator(mode==='quick'?'#timerHud':'#movesHud');
    await expect(counter).toBeVisible();await expect(counter.locator('..')).toHaveClass('board-workspace-progress');
    const counterRect=await counter.boundingBox();const boardRect=await page.locator('#board').boundingBox();
    expect(counterRect.x).toBeGreaterThanOrEqual(0);expect(counterRect.x+counterRect.width).toBeLessThanOrEqual(320);
    expect(counterRect.y+counterRect.height).toBeLessThanOrEqual(boardRect.y);

  });
}
