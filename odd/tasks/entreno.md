# Entreno: segunda parte de Kcalibur (rutinas desde Excel)
Rama: feat/entreno · Entrega: ask-on-risk · Tests: `npm test` (node:test) + Playwright MCP (430x932 y 800x1280)

## Specs
- S1 "si yo importo un excel que se cree el diario de entrenamiento automáticamente" → importador .xlsx (una hoja = un día, 6 semanas, histórico incluido).
- S2 "pestaña que cambie la app completamente" → modo Entreno con barra inferior propia y vuelta a la dieta.
- S3 "tiene que ser facil de usar" → sesión: objetivo, semana anterior como referencia, peso/reps/RIR, descanso.
- S4 Progreso por ejercicio, récords y edición de la rutina (funcionalidades a iterar con feedback de Playwright).

## Tasks
- T1 (S1) Parser puro grid→programa + tests · inline · hecho
- T2 (S1) Migración 0013 + capa de datos + ruta /api/training/import · inline · hecho
- T3 (S2) Modo Entreno: nav, Hoy, Rutina, importador con vista previa · inline · hecho
- T4 (S3) Sesión de entreno + temporizador · inline · hecho
- T5 (S4) Progreso, récords · inline · hecho (edición de rutina pendiente)

## Log
- L1 (2026-11-03) "necesito hacer una pestaña que cambie la app completamente, pasaría a ser la segunda parte para el tema del entreno, tiene que ser facil de usar. por ejemplo mi forma de entrenar es por hojas de cálculo de google, te la meto en el proyecto para veas como es @1º RUTINA - B - TEAMTOCHO SEMANA B.xlsx, entonces si yo importo un excel que se cree el diario de entrenamiento automáticamente, no se que funcioanlidades podemos meterl epero vas a empezar a desarrollar a la vez que con el mcp vas retroalimentando errores y nuevas funcionalidades hasta que lo tengas lo más completo posible"
- Excel analizado: 5 hojas (4 días + core), cabecera fila 4, bloques de semana en E/J/O/T/Y/AD (SERIES, REPS, RIR, PESO X REPS X RIR), vídeo en AI. Nombre de ejercicio = celda combinada A:B; nota = combinada A:D (p. ej. `DESCANSO 2'`, `1" ARRIBA`).
