const fs = require('fs');
const file = 'app/publicaciones/page.js';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  "'use client'\r\n\r\nimport { useState, useEffect } from 'react'",
  "'use client'\r\n\r\nimport { useState, useEffect } from 'react'\r\nimport dynamic from 'next/dynamic'\r\nconst MapaPublicaciones = dynamic(() => import('./MapaPublicaciones'), { ssr: false })"
);

fs.writeFileSync(file, c, 'utf8');
console.log('done:', c.includes('dynamic'));