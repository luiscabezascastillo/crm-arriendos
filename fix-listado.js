const fs = require('fs');
const file = 'app/publicaciones/page.js';
let c = fs.readFileSync(file, 'utf8');

// 1. Añadir captador al select
c = c.replace(
  ".select('id, codigo, direccion, comuna, objetivo, tipo, tipo_moneda, valor, dormitorios, banos, propietario, vendedor, pi, yapo, goplaceit, web, proppit, activo, estado, imagen1, mt2_const'",
  ".select('id, codigo, direccion, comuna, objetivo, tipo, tipo_moneda, valor, dormitorios, banos, propietario, vendedor, captador, pi, yapo, goplaceit, web, proppit, activo, estado, imagen1, mt2_const'"
);

// 2. Añadir cabecera Vendedor después de Captador
c = c.replace(
  "['Imagen','C\u00f3digo','Tipo','Operaci\u00f3n','Estado','Captador','Direcci\u00f3n','Precio','Comuna'",
  "['Imagen','C\u00f3digo','Tipo','Operaci\u00f3n','Estado','Captador','Vendedor','Direcci\u00f3n','Precio','Comuna'"
);

// 3. Añadir celda captador y cambiar vendedor
c = c.replace(
  "{p.vendedor||p.propietario||'\u2014'}",
  "{p.captador||'\u2014'}"
);

fs.writeFileSync(file, c, 'utf8');
console.log('done');