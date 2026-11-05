"""Navigate current cards and explicitly choose the same native assignment under test."""
def open_assignment(page,part):
 card=page.locator(f'[data-live-orders] [data-order-part="{part}"], [data-live-orders] [data-order-parts~="{part}"]').first
 card.wait_for()
 summary=card.locator(':scope > summary')
 if summary.count() and card.get_attribute('open') is None:summary.click()
 card.locator('[data-live-operate]').click()
 page.wait_for_selector('[data-order-form]')
 assignment=page.locator('[data-assignment-select]')
 if assignment.count():assignment.select_option(part)
