# Highway Speedster Graphics Overhaul

## Mode
Redesign · Preserve. Move the visual language toward cinematic dusk realism while retaining the existing game identity, routes, labels, state machine, analytics, persistence keys, and interactions.

## Preserve
- Existing gameplay physics, collision behavior, vehicle names, CTA labels, account flow, garage/store behavior, routes, analytics events, and local/cloud progress schema.
- Existing bike/car selection and unlock contracts.
- Existing reduced-motion behavior and WebGL renderer fallback.

## Improve
- Three.js lighting, materials, road surface, roadside depth, trees, traffic readability, vehicle highlights, and motion cues.
- Account onboarding’s animated 3D-like background and card depth.
- Main menu hero hierarchy, cinematic motion, controls, and responsive contrast.
- Garage turntable/showroom and store cards with more premium depth and state feedback.

## Remove
- Flat/generic surfaces and low-information gradients where layered lighting, depth, or material cues can replace them.
- Visual noise that competes with the selected vehicle or primary action.

## Protected contracts
- Do not rename bikes, cars, store items, screens, routes, analytics events, or persistent state keys.
- Do not change gameplay rules or user-facing navigation semantics.

## Design Read + dials
- Artifact: browser 3D racing game plus account/menu/garage/store UI.
- Audience: international players discovering and replaying a fast arcade racer.
- Visual language: cinematic dusk highway realism with premium motorsport showroom surfaces.
- Mode: preserve with targeted overhaul of visual layers.
- Visual variance: 6/10; motion intensity: 7/10; information density: 5/10; asset dependence: 7/10; brand fidelity: 8/10.
- Palette: carbon black, graphite, warm amber, headlight white, brake-light red, cool steel-blue.
- Typography: existing system sans/display stack; uppercase display labels with compact tracking and readable body copy.
- Spacing: existing 4px rhythm; preserve current responsive breakpoints.
- Radius: 16–28px for hero/panels, 10–16px for controls, sharp geometry for road/vehicle motifs.
- Motion: cinematic ease-out entrances, continuous low-amplitude parallax/road flow, strong but short selection feedback, reduced-motion fallback.

## Highest-risk change
Improving the Three.js scene without increasing frame cost or touching gameplay transforms. Mitigation: visual-only components, capability-aware budgets, pooled/instanced roadside elements, and typecheck/build validation.

## Rollback / fallback
All changes stay in focused visual components and CSS; revert the graphics commit without changing the gameplay store or public routes if performance or renderer compatibility regresses.
