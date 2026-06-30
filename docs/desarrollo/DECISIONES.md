## Decisiones incorporadas desde Chat 17

- **Estado `S` Ãºnico ajustable:** solo los IDADMON en estado `S` se ajustan/notifican.
- **El CRM no recalcula ajustes:** el cÃ¡lculo lo realiza el VBA y se vuelca en `datos_arriendos`; el CRM solo lee. La pÃ¡gina de notificaciones es un visor de solo lectura en la Parte A.
- **`uf_peso_factor` = valor UF del mes:** para contratos UF, `apagar = cuota Ã— uf_peso_factor`, sin aplicar ademÃ¡s `valor_uf` de `indices_mensuales`.

**JustificaciÃ³n:** decisiones permanentes que delimitan la responsabilidad del CRM frente al VBA y evitan reimplementar el cÃ¡lculo.