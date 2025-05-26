# 🤖 HomeAssistant Automation Creation Setup Guide

## Overview

The HomeAssistant Smart Insights application now includes **full automation creation capabilities** that allow you to:

- Generate AI-powered automation suggestions based on your devices
- Preview and customize automations with YAML validation
- Deploy automations directly to your HomeAssistant server
- Monitor connection status and handle errors gracefully

## 🚀 Quick Setup

### 1. Generate HomeAssistant Long-Lived Access Token

1. **Open HomeAssistant** in your browser
2. **Navigate to Profile** → Click your profile picture in the bottom left
3. **Go to Security tab** → Scroll down to "Long-Lived Access Tokens"
4. **Create Token** → Click "Create Token" button
5. **Copy Token** → Save the generated token securely (you won't see it again!)

### 2. Configure Environment Variables

Add these to your `.env` file:

```bash
# HomeAssistant configuration (used for both data visualization and automation creation)
VITE_HOMEASSISTANT_URL=http://192.168.1.100:8123
VITE_HOMEASSISTANT_TOKEN=your_long_lived_access_token_here
```

### 3. Verify Connection

1. **Start the application** (`npm run dev` or Docker)
2. **Navigate to Analytics Dashboard**
3. **Check Automation Suggestions card** for connection status
4. **Green dot** = Connected ✅ | **Red dot** = Disconnected ❌

## 🎯 How to Create Automations

### Step 1: Browse Suggestions
- Navigate to **Analytics Dashboard** → **Automation Suggestions**
- Review AI-generated suggestions based on your available devices
- Each suggestion shows:
  - **Priority** (High/Medium/Low)
  - **Category** (Energy/Security/Comfort/etc.)
  - **Impact** (estimated savings or benefits)
  - **Required entities** (devices needed)

### Step 2: Create Automation
1. **Click "Create →"** on any suggestion
2. **Preview** the automation details and requirements
3. **Customize** the automation:
   - Change name and description
   - Modify execution mode (Single/Restart/Queued/Parallel)
   - Preview YAML configuration
4. **Validate** the automation:
   - Check for missing entities
   - Review warnings and errors
   - Ensure all requirements are met
5. **Deploy** to HomeAssistant:
   - Automation is created and activated
   - Automatic reload of HomeAssistant automations

### Step 3: Verify in HomeAssistant
1. **Go to HomeAssistant** → **Settings** → **Automations & Scenes**
2. **Find your automation** in the list
3. **Test the automation** by triggering its conditions
4. **Monitor execution** in HomeAssistant logs

## 🔧 Supported Automation Types

### 1. Motion-Activated Lighting
**Detects:** Motion sensors + Light entities
**Creates:** Smart lighting that turns on with motion, off after delay
**Benefits:** 15-25% energy savings, convenience

**Example entities required:**
- `binary_sensor.motion_sensor_living_room`
- `light.living_room_lights`

### 2. Climate Presence Control
**Detects:** Presence sensors + Climate entities
**Creates:** Temperature adjustment when nobody's home
**Benefits:** $20-40/month energy savings

**Example entities required:**
- `person.john_doe` or `device_tracker.phone`
- `climate.main_thermostat`

### 3. Security Notifications
**Detects:** Door/window sensors
**Creates:** Alerts during specific hours (night/away)
**Benefits:** Enhanced security monitoring

**Example entities required:**
- `binary_sensor.front_door`
- `binary_sensor.window_sensor`

### 4. Energy Optimization
**Detects:** Smart switches, power monitoring
**Creates:** Automated device scheduling
**Benefits:** Reduced standby power consumption

## 🛠️ Advanced Configuration

### Custom Entity Mapping
If the app doesn't detect your entities correctly, you can:

1. **Check entity names** in HomeAssistant → Developer Tools → States
2. **Ensure device classes** are set correctly:
   - Motion sensors: `device_class: motion`
   - Door sensors: `device_class: door`
   - Window sensors: `device_class: window`

### Automation Modes Explained

- **Single**: Only one instance runs at a time
- **Restart**: Restart automation if triggered while running
- **Queued**: Queue multiple instances (with max limit)
- **Parallel**: Run multiple instances simultaneously

### YAML Customization
The app generates standard HomeAssistant YAML that you can:
- Copy and paste into your `automations.yaml`
- Modify manually in HomeAssistant
- Use as a template for more complex automations

## 🔒 Security Considerations

### ⚠️ Important Security Notes

1. **Token Security**:
   - Long-lived access tokens provide **full HomeAssistant access**
   - Store tokens securely, never commit to version control
   - Consider creating a dedicated user for automation creation

2. **Network Security**:
   - Ensure HomeAssistant is not exposed to the internet without proper security
   - Use HTTPS when possible
   - Consider VPN access for remote management

3. **Automation Review**:
   - Always review automations before deployment
   - Test in a safe environment first
   - Monitor automation behavior after deployment

### Best Practices

1. **Dedicated User**: Create a HomeAssistant user specifically for automation creation
2. **Token Rotation**: Regularly rotate long-lived access tokens
3. **Backup**: Export automations before making changes
4. **Testing**: Test automations in development mode first

## 🐛 Troubleshooting

### Connection Issues

**Problem**: Red connection indicator, "Connection Failed"
**Solutions**:
1. Verify HomeAssistant URL is correct and accessible
2. Check that HomeAssistant is running and responsive
3. Ensure access token has admin privileges
4. Test API access: `curl -H "Authorization: Bearer YOUR_TOKEN" http://your-ha:8123/api/`

### Missing Entities

**Problem**: "Some entities may not exist" warning
**Solutions**:
1. Check entity IDs in HomeAssistant → Developer Tools → States
2. Ensure devices are properly configured and online
3. Update entity IDs in the customization step
4. Some suggestions may not apply to your specific setup

### Automation Creation Fails

**Problem**: "Failed to create automation" error
**Solutions**:
1. Check HomeAssistant logs for detailed error messages
2. Ensure user has configuration write permissions
3. Verify YAML syntax is valid
4. Check for conflicting automation names

### API Timeout

**Problem**: Requests timeout or fail
**Solutions**:
1. Check network connectivity to HomeAssistant
2. Increase timeout in service configuration
3. Ensure HomeAssistant isn't overloaded
4. Try creating simpler automations first

## 📚 Additional Resources

- [HomeAssistant Automation Documentation](https://www.home-assistant.io/docs/automation/)
- [Long-Lived Access Tokens Guide](https://www.home-assistant.io/docs/authentication/#long-lived-access-tokens)
- [YAML Automation Syntax](https://www.home-assistant.io/docs/automation/yaml/)
- [HomeAssistant API Reference](https://developers.home-assistant.io/docs/api/rest/)

## 🆘 Support

If you encounter issues:

1. **Check the browser console** for error messages
2. **Review HomeAssistant logs** for API errors
3. **Verify network connectivity** between app and HomeAssistant
4. **Test with simple automations** first
5. **Create an issue** on GitHub with detailed error information

---

**Happy Automating! 🏠🤖** 