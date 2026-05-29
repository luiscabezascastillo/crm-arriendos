const fs = require('fs');
const file = 'app/publicaciones/page.js';
let lines = fs.readFileSync(file, 'utf8').split('\n');

// Insertar cierres faltantes entre línea 102 y 103 (índice 102)
const insert = [
  "    })",
  "    }",
  "    init()",
  "    return () => { if (_mapInstance) { _mapInstance.remove(); _mapInstance = null; _mapL = null } }",
  "  }, [pubs])",
  "",
  "  return ("
];

lines.splice(102, 0, ...insert);
fs.writeFileSync(file, lines.join('\n'), 'utf8');
console.log('done, lines:', lines.length);