# PLC Trainer

A browser-based PLC and industrial automation training simulator. Program in **Ladder Logic** and **Structured Text**, simulate a PLC scan cycle, wire up **I/O**, build **process simulations**, and explore **IIoT** — all without real hardware.

## Features

- **Ladder Logic editor** — drag-and-drop rungs, contacts, coils, timers, counters, math/compare instructions, nested parallel branches, live power-flow animation and online value monitoring.
- **Structured Text editor** — CodeMirror-based editor with syntax highlighting, tag autocomplete, `IF/CASE/FOR/WHILE`, and the same instruction set as ladder.
- **PLC runtime** — tag database (BOOL/SINT/INT/DINT/REAL/TIMER/COUNTER, arrays, controller/program scope), configurable scan time, subroutines (JSR).
- **I/O configuration** — chassis/slot/module setup (1756-IB16/OB16E/IF8/OF8), analog scaling, and a simulated I/O panel.
- **Plant simulation** — drag-and-drop motors, conveyors, tanks, valves, pumps, traffic lights, heaters, fans and sensors with real behaviour, wired to tags.
- **HMI / SCADA** — dashboard widgets (indicators, buttons, gauges, bars, trends) bound to tags.
- **IIoT** — built-in MQTT broker simulation with wildcards and retained messages, optional real broker over WebSockets, plus a Modbus register-map simulator.
- **Training** — sample scenarios with automatic objective checks.

## Getting started

```bash
npm install
npm run dev      # open http://localhost:5173
```

## Scripts

```bash
npm run dev        # development server
npm run build      # production build
npm run test       # run the engine/parser tests
npm run typecheck  # TypeScript check
npm run lint       # ESLint
```

## Tech

React + TypeScript + Vite · Zustand · CodeMirror 6 · Vitest. Fully client-side; projects are saved locally and can be exported/imported as JSON.

## Note

This is a teaching simulator, not a replacement for a real PLC. Use it to learn the concepts, then transfer them to real hardware.
