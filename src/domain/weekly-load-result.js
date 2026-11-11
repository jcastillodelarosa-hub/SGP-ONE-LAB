export function weeklyLoadResult(data, fallbackTotal = 0) {
  const count = value => Number.isInteger(Number(value)) && Number(value) >= 0 ? Number(value) : 0;
  const inserted = count(data?.insertados?.total ?? fallbackTotal);
  const moved = count(data?.actualizados?.programacion);
  const reused = ['piezas', 'accesorios', 'vidrio'].reduce((sum, key) => sum + count(data?.reutilizados?.[key]), 0);
  return {
    inserted, moved, reused,
    text: `${inserted} registros nuevos · ${moved} producciones movidas de semana · ${reused} materiales conservados`
  };
}
