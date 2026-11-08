"""Current unmodified sheet navigation. Legacy write contracts remain in SQL/API suites."""
RETIRED='[data-order-form],[data-executed],[data-open],[data-import],[data-close],[data-close-empty],[data-reopen],[data-turn-capacity]'
def inspect_sheet(page,stage='EMPAQUE',detail=False):
 page.wait_for_selector('[data-assembly-close]')
 assert 'Hoja de '+('Empaque' if stage=='EMPAQUE' else 'Ensamble') in page.locator('[data-live-orders]').inner_text()
 assert page.locator(RETIRED).count()==0
 if stage=='EMPAQUE':assert page.locator('[data-assembly-glass],[data-assembly-incorporate]').count()==0
 if detail:
  page.locator('button[data-assembly-detail]').first.click();page.wait_for_selector('section[data-assembly-detail]')
  assert 'Saldo '+('Empaque' if stage=='EMPAQUE' else 'Ensamble') in page.locator('section[data-assembly-detail]').inner_text()
  assert page.locator(RETIRED).count()==0
  page.locator('[data-assembly-back]').click();page.wait_for_selector('[data-assembly-key]')
 page.locator('[data-assembly-close]').click();page.wait_for_selector('[data-assembly-close-back]')
 assert page.locator(RETIRED).count()==0
 page.locator('[data-assembly-close-back]').click();page.wait_for_selector('[data-assembly-close]')
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
