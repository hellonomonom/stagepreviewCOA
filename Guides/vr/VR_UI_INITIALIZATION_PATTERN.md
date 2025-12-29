# VR UI/Navigation Element Initialization Pattern

## Overview

This document describes the reliable pattern for initializing VR UI and navigation elements that depend on `VRInputManager`. This pattern ensures that interactive objects are properly registered and functional even when initialization timing varies.

## The Problem

VR components initialize asynchronously with staggered delays to improve performance. This means:
- `VRInputManager` may not be immediately available when UI elements are created
- UI elements need to wait for `inputManager` to be ready before registering interactions
- Previous patterns using `setTimeout` retries were unreliable

## The Solution

### 1. VRInputManager Ready State

`VRInputManager` now tracks its ready state and provides a promise-based API:

```javascript
// Check if ready
if (inputManager.isReady()) {
  // Safe to use
}

// Wait for ready (returns Promise)
await inputManager.waitForReady();
```

### 2. VRManager Helper Method

`VRManager` provides a helper method that UI elements should use:

```javascript
// Using callback
vrManager.waitForInputManager((inputManager) => {
  if (!inputManager) {
    console.error('InputManager not available');
    return;
  }
  
  // Register your interactive object
  inputManager.registerInteractiveObject(myButton);
  
  // Set up event handlers
  inputManager.onHoverStart((object) => {
    if (object === myButton) {
      // Handle hover
    }
  });
  
  inputManager.onSelectStart((object) => {
    if (object === myButton) {
      // Handle selection
    }
  });
});

// Using promise
vrManager.waitForInputManager()
  .then((inputManager) => {
    inputManager.registerInteractiveObject(myButton);
    // ... set up handlers
  })
  .catch((error) => {
    console.error('Failed to get inputManager:', error);
  });
```

## Complete Example: Creating a VR Button

```javascript
function createVRButton() {
  // 1. Guard: Ensure VRManager and required dependencies exist
  if (!vrManager || !vrFloorMesh) {
    setTimeout(createVRButton, 500);
    return;
  }
  
  // 2. Avoid duplicate creation
  if (vrManager._myButton) return;
  
  // 3. Create the 3D object
  const button = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.1, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x0077ff })
  );
  button.name = 'MyVRButton';
  button.position.set(0, 1.5, -0.8);
  
  // 4. Add to scene using VRManager helper (handles VR offset correctly)
  vrManager.addToScene(button);
  
  // 5. Register with inputManager using reliable pattern
  vrManager.waitForInputManager((inputManager) => {
    if (!inputManager) {
      console.error('MyVRButton: Failed to get inputManager');
      return;
    }
    
    // Register as interactive
    inputManager.registerInteractiveObject(button);
    
    // Set up hover feedback
    inputManager.onHoverStart((object) => {
      if (object === button) {
        button.material.color.setHex(0x33aaff);
        button.scale.set(1.05, 1.05, 1.05);
      }
    });
    
    inputManager.onHoverEnd((object) => {
      if (object === button) {
        button.material.color.setHex(0x0077ff);
        button.scale.set(1, 1, 1);
      }
    });
    
    // Set up selection action
    inputManager.onSelectStart((object) => {
      if (object === button) {
        // Perform action
        doSomething();
      }
    });
    
    console.log('MyVRButton: Successfully registered');
  }).catch((error) => {
    console.error('MyVRButton: Error:', error);
  });
  
  // 6. Store reference to prevent duplicates
  vrManager._myButton = button;
}
```

## Key Principles

1. **Always use `vrManager.waitForInputManager()`** - Don't use `setTimeout` retries or direct checks
2. **Add objects to scene first** - Use `vrManager.addToScene()` to ensure correct parent (handles VR offset)
3. **Register interactions after inputManager is ready** - Use the callback/promise from `waitForInputManager()`
4. **Handle errors gracefully** - Check if `inputManager` is null in the callback
5. **Store references** - Prevent duplicate creation by storing references on `vrManager`

## When to Call UI Creation

### Option 1: On VR Enter (Recommended)

```javascript
vrManager.onVREnter(() => {
  createVRButton();
});
```

### Option 2: On Floor Load

```javascript
meshLoader.onFloorLoaded = (floorMesh) => {
  // ... other floor setup
  createVRButton();
};
```

### Option 3: Immediately (if VR is already active)

```javascript
if (vrManager && vrManager.getIsVRActive()) {
  createVRButton();
}
```

## Benefits

- **Reliable**: Promise-based system ensures proper initialization order
- **Error Handling**: Built-in timeout and error handling
- **Clean API**: Simple callback or promise pattern
- **Future-proof**: Works even if initialization timing changes
- **No Polling**: No need for `setTimeout` retry loops

## Migration Guide

If you have existing UI elements using the old pattern:

**Old Pattern:**
```javascript
const registerButton = () => {
  if (!vrManager || !vrManager.inputManager) {
    setTimeout(registerButton, 300);
    return;
  }
  vrManager.inputManager.registerInteractiveObject(button);
};
registerButton();
```

**New Pattern:**
```javascript
vrManager.waitForInputManager((inputManager) => {
  if (!inputManager) return;
  inputManager.registerInteractiveObject(button);
}).catch((error) => {
  console.error('Error:', error);
});
```

## Testing

After creating a UI element:
1. Enter VR mode
2. Verify the element is visible
3. Verify hover feedback works
4. Verify selection/click works
5. Exit and re-enter VR to test initialization reliability

## Troubleshooting

### Element not visible
- Check that `vrManager.addToScene()` was used
- Verify object position is within view
- Check console for errors

### Interactions not working
- Verify `waitForInputManager()` callback was called
- Check that `inputManager.registerInteractiveObject()` was called
- Verify event handlers are set up correctly
- Check console for registration messages

### Element appears after delay
- This is expected - initialization is staggered for performance
- Elements should appear within 500ms of VR entry
- If longer, check for errors in console











