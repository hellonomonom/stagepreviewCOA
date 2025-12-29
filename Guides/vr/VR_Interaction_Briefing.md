#### Guidelines for VR interaction





Should work for



Quest 3 with hand tracking

Quest 3 with controllers
Apple Vision Pro with eyes (gaze)







##### 1\. Think “Actions”, Not Devices



First, design your app around abstract actions, not specific hardware:



primarySelect – tap / pinch / trigger press

secondaryAction – long pinch / grip / secondary button

navigateBack – cancel / go back

systemMenu – don’t override; leave to OS

scroll/rotate – for lists, carousels, dials



Then you map these per device:









Action		Controllers (Quest)	Hands (Quest/Vision)			Eyes / Gaze (Vision-ish)

primarySelect	Trigger press		Pinch / grab gesture			Gaze target + pinch or air tap

secondaryAction	Grip / A/B/Y/X		Two-finger pinch / long pinch		Gaze + long pinch/hold

hover		Ray intersection	Ray from index / palm / pinch cursor	Gaze intersection







##### 2\. Use Common Interaction Patterns


2.1. Ray + Target Pattern (Works Everywhere)
---



Even with hands/eyes, a ray + target metaphor is still the most robust:



Controllers: ray from controller → 3D UI elements

Hands: ray from index finger / pinch position

Eyes: virtual “gaze ray” from head/eye direction





UX tips:



Use clear “hit area” affordances:



Slightly elevated planes, cards, or buttons

Subtle outlines or drop shadows



On hover:

Scale up a tiny bit (1.05x)

Add glow/border and maybe a light sound



On select:

Depress animation (button sinks a bit)

Quick spring-back



Don’t rely on tiny 2D UI like a web form – think big, chunky, spatial widgets.





#### 3\. Design for Hand Interaction





###### 3.1. Big Targets



Min hit size: ~2.5–3 cm in world space at arm’s length

Avoid thin toggles/sliders as primary controls



Prefer:



Big cards

Tiles and chips

Radial menus close to hand





###### 3.2. Pinch as Click



Use pinch to select, not to hover.

Use steady ray or cursor for hover, then pinch to confirm.







###### 3.3. Avoid Constant Grip Gestures



Continuous grips tire users quickly. Prefer:



Single pinch to grab, release to drop



Short, discrete gestures instead of “hold this pose for 5 seconds”







#### 4\. Design for Eye / Gaze Interaction



If you support gaze or head-aiming:



4.1. Gaze is for Targeting, Not Clicking

Combine gaze with another action:



Gaze + pinch / click



Gaze + short dwell (e.g. 500–800 ms) for secondary actions



Always give feedback:



Focus ring around the object



Slight scale/brightness change



4.2. Avoid Accidental Gaze Activations



Don’t trigger primary actions on gaze-only.



For dwell:



Show a progress ring filling up



Allow users to cancel by looking away





4.3. Keep Important UI Near Center



Gaze interaction is best in ~20–30° around the center:



Put primary UI in that zone



Use peripheral space for ambient info, background content





#### 5\. Controller UX (Quest 3)



Controllers are still the most precise, so you can allow slightly finer controls, but:



Keep consistency:



Trigger = primarySelect



Grip = grab



A/B or X/Y = contextual actions (open radial menu, back, confirm)



Avoid overloading buttons:



One button = one concept



If you must overload, change button label and show a tooltip.





#### 6\. Layout \& Comfort

6.1. Comfortable Reach



Primary UI: imagine a curved panel 0.8–1.2 m in front of the user



Vertical range: roughly shoulder to eye level



Avoid placing critical controls:



Above the head



Behind the user



Far below waist level





6.2. Depth and Layering



Separate layers:



Foreground UI (panels, buttons) around 1 m



Content objects at varying depths



Background environment far away



Depth helps user understand what is interactive vs decorative.





#### 7\. Feedback, Feedback, Feedback



Across all input types, add clear feedback:



Hover (focus)



Outline, subtle glow, small scale up



Ready-to-select



Stronger outline, maybe a color change



On select



Press animation



Brief sound



Haptic pulse (for controllers)



Success / failure



Checkmarks, color changes, micro-animations



Tooltips if something is disabled



If you support multiple input modes, keep the feedback visuals the same so users don’t feel like they’re in a different app when they switch from controllers to hands.





#### 8\. Discoverability \& Mode Switching



Users often don’t know which input modalities you support.



Add a simple “input help” overlay:



Shows controller diagrams OR hand icons



Short text: “Point and pinch to select” / “Gaze + pinch to activate”



Automatically detect:



If hands become visible → show a quick “hand hint”



If controllers are active → show controller hints once



Avoid deep settings menus just to change input mode. Prefer:



Automatic detection + a small toggle in the main menu:

“Input: Auto / Controllers / Hands”





#### 9\. Accessibility \& Fatigue



Design for people who:



Can’t hold their arms up long



Have shaky hands



Are new to XR



Tips:



Support head / gaze + click as a low-effort alternative



Keep interactions short and discrete, not long drag gestures



Animations should be:



Fast (150–250 ms) but not flashy



Avoid flicker, strong strobe or extreme FOV changes



Provide a “recenter” or “reset view” control always accessible





#### 10\. Structuring This in Your Three.js Code



When you implement this, a clean pattern is:



Input Manager



Knows about:



Controllers

Hands

Gaze / head pose



Produces unified events:



onHoverStart(object)



onHoverEnd(object)



onSelectStart(object)



onSelectEnd(object)





UI Components



Buttons, sliders, panels are just Three.js meshes with:



interactive = true



Handlers for those events



They decide:



How to animate



What to do on click



Mode Detection



If a controller is connected → use controller rays



Else if hand tracking available → use hand ray



Else → fallback to head/gaze ray



This keeps your app logic mostly input-agnostic.





#### 11\. Common Pitfalls to Avoid



Tiny desktop-like UI: dropdowns, small checkboxes, toolbars with 20 icons.



No feedback on hover/selection: makes users think input is broken.



Too many gestures: users won’t remember more than a few (pinch, grab, point).



Locking UI to real-world scale: XR UIs can be “physically big” but still feel normal; don’t be afraid of oversized UI.



Mixing locomotion with micro-interactions: try not to require precision actions while the user is teleporting / moving.

