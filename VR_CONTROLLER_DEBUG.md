# VR Controller Debug Display

## What Was Added

A real-time debug text display that shows on each controller in VR, displaying:
- ✅ Button states (all buttons, which ones are pressed)
- ✅ Button values (analog pressure values)
- ✅ Thumbstick/Axis values
- ✅ Trigger/Select state
- ✅ Real-time updates every frame

## How It Works

### Visual Display
- **Location**: Floating above each controller
- **Style**: Black background with white/green text
- **Format**: Shows controller name, button states, axes, and trigger state
- **Updates**: Real-time (every frame)

### What You'll See

```
RIGHT Controller
Buttons: 4
  B0: --- (0.00)
  B1: PRESSED (1.00)  <- B button
  B2: --- (0.00)
  B3: --- (0.00)
Axes: 4
  A0: 0.12
  A1: -0.05
  A2: 0.00
  A3: 0.00
Select/Trigger: PRESSED
```

## Button Mappings (Quest 3)

- **Right Controller:**
  - B0 = Trigger (Select)
  - B1 = B Button (Menu toggle)
  - B2 = Grip
  - B3 = A Button

- **Left Controller:**
  - B0 = Trigger (Select)
  - B3 = Y Button (Menu toggle)
  - B2 = Grip
  - B1 = X Button

- **Axes (Thumbstick):**
  - A0 = Horizontal (X)
  - A1 = Vertical (Y)
  - A2 = Additional axis (if available)
  - A3 = Additional axis (if available)

## Using the Debug Display

1. **Enter VR mode**
2. **Look at your controllers** - you should see debug text above each one
3. **Press buttons** - watch the display update in real-time
4. **Press trigger** - see "Select/Trigger: PRESSED" appear

## Disabling Debug Display

To disable the debug display, you can:

```javascript
// In browser console or code
vrManager.controllers.setDebugEnabled(false);
```

To enable again:
```javascript
vrManager.controllers.setDebugEnabled(true);
```

## What This Helps Debug

1. **Button Detection**: See if buttons are being detected
2. **Button Mapping**: Verify which button index corresponds to which physical button
3. **Trigger Detection**: Confirm trigger events are firing
4. **Thumbstick Values**: See thumbstick input values
5. **Controller Connection**: Verify controllers are connected (if no gamepad data, controllers might not be connected)

## Troubleshooting

### "No gamepad data" shown:
- Controllers might not be fully connected
- Check if controllers are tracked (do you see the white laser pointer?)
- Try re-entering VR mode

### Buttons not showing as pressed:
- Check button mappings - buttons might be at different indices
- Some buttons might not be supported on your controller model

### Debug text not visible:
- Make sure you're looking at the controller from the right angle
- The text is positioned above the controller
- Try moving your hand closer

## Example Debug Output

When you press the right trigger:
```
RIGHT Controller
Buttons: 4
  B0: PRESSED (1.00)  <- Trigger pressed
  B1: --- (0.00)
Select/Trigger: PRESSED
```

When you press the B button:
```
RIGHT Controller
Buttons: 4
  B0: --- (0.00)
  B1: PRESSED (1.00)  <- B button pressed
Select/Trigger: ---
```

---

**This debug display will help you see exactly what buttons are being pressed and whether the controller input is correctly wired up!**



