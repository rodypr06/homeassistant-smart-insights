interface HomeAssistantConfig {
  baseUrl: string;
  accessToken: string;
  timeout?: number;
}

interface AutomationTrigger {
  platform: string;
  entity_id?: string;
  state?: string;
  from?: string;
  to?: string;
  at?: string;
  event?: string;
  event_data?: Record<string, any>;
  zone?: string;
  device_id?: string;
  type?: string;
  subtype?: string;
  [key: string]: any;
}

interface AutomationCondition {
  condition: string;
  entity_id?: string;
  state?: string;
  above?: number;
  below?: number;
  value_template?: string;
  [key: string]: any;
}

interface AutomationAction {
  service?: string;
  entity_id?: string;
  data?: Record<string, any>;
  target?: {
    entity_id?: string | string[];
    device_id?: string | string[];
    area_id?: string | string[];
  };
  delay?: string;
  wait_template?: string;
  event?: string;
  event_data?: Record<string, any>;
  [key: string]: any;
}

interface HomeAssistantAutomation {
  id?: string;
  alias: string;
  description?: string;
  trigger: AutomationTrigger | AutomationTrigger[];
  condition?: AutomationCondition | AutomationCondition[];
  action: AutomationAction | AutomationAction[];
  mode?: 'single' | 'restart' | 'queued' | 'parallel';
  max?: number;
  max_exceeded?: 'silent' | 'critical' | 'fatal';
  variables?: Record<string, any>;
  trace?: {
    stored_traces?: number;
  };
}

interface AutomationSuggestion {
  id: string;
  title: string;
  description: string;
  category: 'energy' | 'security' | 'comfort' | 'maintenance' | 'convenience';
  priority: 'low' | 'medium' | 'high' | 'critical';
  impact: string;
  estimatedSavings?: number;
  automation: HomeAssistantAutomation;
  requiredEntities: string[];
  tags: string[];
}

interface AutomationValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  missingEntities: string[];
}

class HomeAssistantAutomationService {
  private config: HomeAssistantConfig;
  private baseHeaders: Record<string, string>;

  constructor() {
    this.config = {
      baseUrl: import.meta.env.VITE_HOMEASSISTANT_URL || 'http://localhost:8123',
      accessToken: import.meta.env.VITE_HOMEASSISTANT_TOKEN || '',
      timeout: 10000
    };

    this.baseHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.accessToken}`,
    };

    if (!this.config.accessToken) {
      console.warn('⚠️ HomeAssistant access token not configured. Set VITE_HOMEASSISTANT_TOKEN environment variable.');
    }
  }

  // API Communication Methods
  private async makeRequest<T>(
    endpoint: string, 
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', 
    data?: any
  ): Promise<T> {
    const url = `${this.config.baseUrl}/api/${endpoint}`;
    
    try {
      const response = await fetch(url, {
        method,
        headers: this.baseHeaders,
        body: data ? JSON.stringify(data) : undefined,
        signal: AbortSignal.timeout(this.config.timeout || 10000)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HomeAssistant API Error (${response.status}): ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('HomeAssistant API request timed out');
        }
        throw new Error(`HomeAssistant API Error: ${error.message}`);
      }
      throw new Error('Unknown HomeAssistant API error');
    }
  }

  // Test connection to HomeAssistant
  async testConnection(): Promise<{ connected: boolean; version?: string; error?: string }> {
    try {
      const response = await this.makeRequest<{ message: string; version: string }>('');
      return {
        connected: true,
        version: response.version
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Get all entities from HomeAssistant
  async getEntities(): Promise<Array<{ entity_id: string; state: string; attributes: Record<string, any> }>> {
    try {
      return await this.makeRequest<Array<{ entity_id: string; state: string; attributes: Record<string, any> }>>('states');
    } catch (error) {
      console.error('Failed to fetch entities:', error);
      return [];
    }
  }

  // Get existing automations
  async getAutomations(): Promise<HomeAssistantAutomation[]> {
    try {
      return await this.makeRequest<HomeAssistantAutomation[]>('config/automation/config');
    } catch (error) {
      console.error('Failed to fetch automations:', error);
      return [];
    }
  }

  // Create new automation
  async createAutomation(automation: HomeAssistantAutomation): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      // Validate automation before creating
      const validation = await this.validateAutomation(automation);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Validation failed: ${validation.errors.join(', ')}`
        };
      }

      // Create automation via config flow
      const response = await this.makeRequest<{ id: string }>('config/automation/config', 'POST', automation);
      
      // Reload automations to make it active
      await this.reloadAutomations();
      
      return {
        success: true,
        id: response.id
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Update existing automation
  async updateAutomation(id: string, automation: HomeAssistantAutomation): Promise<{ success: boolean; error?: string }> {
    try {
      await this.makeRequest(`config/automation/config/${id}`, 'PUT', automation);
      await this.reloadAutomations();
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Delete automation
  async deleteAutomation(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.makeRequest(`config/automation/config/${id}`, 'DELETE');
      await this.reloadAutomations();
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Reload automations
  async reloadAutomations(): Promise<void> {
    try {
      await this.makeRequest('services/automation/reload', 'POST');
    } catch (error) {
      console.error('Failed to reload automations:', error);
    }
  }

  // Validate automation configuration
  async validateAutomation(automation: HomeAssistantAutomation): Promise<AutomationValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const missingEntities: string[] = [];

    // Basic validation
    if (!automation.alias || automation.alias.trim() === '') {
      errors.push('Automation alias is required');
    }

    if (!automation.trigger) {
      errors.push('At least one trigger is required');
    }

    if (!automation.action) {
      errors.push('At least one action is required');
    }

    // Get available entities for validation
    const entities = await this.getEntities();
    const entityIds = entities.map(e => e.entity_id);

    // Validate entity references
    const checkEntityExists = (entityId: string) => {
      if (entityId && !entityIds.includes(entityId)) {
        missingEntities.push(entityId);
      }
    };

    // Check triggers
    const triggers = Array.isArray(automation.trigger) ? automation.trigger : [automation.trigger];
    triggers.forEach(trigger => {
      if (trigger.entity_id) {
        checkEntityExists(trigger.entity_id);
      }
    });

    // Check conditions
    if (automation.condition) {
      const conditions = Array.isArray(automation.condition) ? automation.condition : [automation.condition];
      conditions.forEach(condition => {
        if (condition.entity_id) {
          checkEntityExists(condition.entity_id);
        }
      });
    }

    // Check actions
    const actions = Array.isArray(automation.action) ? automation.action : [automation.action];
    actions.forEach(action => {
      if (action.entity_id) {
        checkEntityExists(action.entity_id);
      }
      if (action.target?.entity_id) {
        const targetEntities = Array.isArray(action.target.entity_id) 
          ? action.target.entity_id 
          : [action.target.entity_id];
        targetEntities.forEach(checkEntityExists);
      }
    });

    if (missingEntities.length > 0) {
      warnings.push(`Some entities may not exist: ${missingEntities.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      missingEntities
    };
  }

  // Generate automation suggestions based on available entities and patterns
  async generateAutomationSuggestions(): Promise<AutomationSuggestion[]> {
    const entities = await this.getEntities();
    const existingAutomations = await this.getAutomations();
    const suggestions: AutomationSuggestion[] = [];

    console.log(`🔍 Analyzing ${entities.length} entities for automation suggestions...`);

    // Helper function to extract area/room from entity name
    const extractArea = (entityId: string): string => {
      const parts = entityId.split('.');
      if (parts.length > 1) {
        const name = parts[1];
        // Common room patterns
        const roomPatterns = [
          'living_room', 'livingroom', 'living',
          'bedroom', 'bed_room', 'master_bedroom',
          'kitchen', 'dining_room', 'diningroom',
          'bathroom', 'bath_room', 'toilet',
          'office', 'study', 'den',
          'garage', 'basement', 'attic',
          'hallway', 'corridor', 'entrance',
          'porch', 'patio', 'deck',
          'guest_room', 'kids_room', 'nursery'
        ];
        
        for (const pattern of roomPatterns) {
          if (name.includes(pattern)) {
            return pattern.replace('_', ' ');
          }
        }
        
        // Extract first part as potential area
        const firstPart = name.split('_')[0];
        if (firstPart.length > 2) {
          return firstPart;
        }
      }
      return 'unknown';
    };

    // Helper function to check if automation already exists
    const automationExists = (alias: string): boolean => {
      return existingAutomations.some(auto => 
        auto.alias.toLowerCase().includes(alias.toLowerCase()) ||
        alias.toLowerCase().includes(auto.alias.toLowerCase())
      );
    };

    // Categorize entities by type and area
    const entityGroups = {
      lights: entities.filter(e => e.entity_id.startsWith('light.')),
      motionSensors: entities.filter(e => 
        e.entity_id.includes('motion') || 
        e.entity_id.includes('occupancy') ||
        e.attributes.device_class === 'motion'
      ),
      doorSensors: entities.filter(e => 
        (e.entity_id.includes('door') || e.entity_id.includes('entry')) &&
        (e.attributes.device_class === 'door' || e.attributes.device_class === 'opening')
      ),
      windowSensors: entities.filter(e => 
        e.entity_id.includes('window') &&
        (e.attributes.device_class === 'window' || e.attributes.device_class === 'opening')
      ),
      climateDevices: entities.filter(e => e.entity_id.startsWith('climate.')),
      switches: entities.filter(e => e.entity_id.startsWith('switch.')),
      covers: entities.filter(e => e.entity_id.startsWith('cover.')),
      locks: entities.filter(e => e.entity_id.startsWith('lock.')),
      presenceSensors: entities.filter(e => 
        e.entity_id.startsWith('person.') ||
        e.entity_id.startsWith('device_tracker.') ||
        e.entity_id.includes('presence')
      ),
      temperatureSensors: entities.filter(e => 
        e.attributes.device_class === 'temperature' ||
        e.entity_id.includes('temperature')
      ),
      humiditySensors: entities.filter(e => 
        e.attributes.device_class === 'humidity' ||
        e.entity_id.includes('humidity')
      ),
      smokeSensors: entities.filter(e => 
        e.attributes.device_class === 'smoke' ||
        e.entity_id.includes('smoke')
      ),
      waterSensors: entities.filter(e => 
        e.attributes.device_class === 'moisture' ||
        e.entity_id.includes('water') ||
        e.entity_id.includes('leak')
      )
    };

    // 1. MOTION-ACTIVATED LIGHTING (Area-based matching)
    const areaLightMotionPairs: { [area: string]: { lights: any[], motions: any[] } } = {};
    
    // Group lights and motion sensors by area
    entityGroups.lights.forEach(light => {
      const area = extractArea(light.entity_id);
      if (!areaLightMotionPairs[area]) areaLightMotionPairs[area] = { lights: [], motions: [] };
      areaLightMotionPairs[area].lights.push(light);
    });
    
    entityGroups.motionSensors.forEach(motion => {
      const area = extractArea(motion.entity_id);
      if (!areaLightMotionPairs[area]) areaLightMotionPairs[area] = { lights: [], motions: [] };
      areaLightMotionPairs[area].motions.push(motion);
    });

    // Create suggestions for each area with both lights and motion sensors
    Object.entries(areaLightMotionPairs).forEach(([area, { lights, motions }]) => {
      if (lights.length > 0 && motions.length > 0 && area !== 'unknown') {
        const automationName = `Motion Lights - ${area.charAt(0).toUpperCase() + area.slice(1)}`;
        
        if (!automationExists(automationName)) {
          suggestions.push({
            id: `motion_lights_${area}`,
            title: automationName,
            description: `Turn on ${area} lights when motion detected, turn off after 5 minutes of no motion`,
            category: 'convenience',
            priority: 'medium',
            impact: '15-25% energy savings',
            estimatedSavings: 20,
            requiredEntities: [lights[0].entity_id, motions[0].entity_id],
            tags: ['motion', 'lighting', 'energy', area],
            automation: {
              alias: automationName,
              description: `Automatically control ${area} lighting based on motion detection`,
              trigger: [
                {
                  platform: 'state',
                  entity_id: motions[0].entity_id,
                  to: 'on'
                },
                {
                  platform: 'state',
                  entity_id: motions[0].entity_id,
                  to: 'off',
                  for: '00:05:00'
                }
              ],
              action: [
                {
                  choose: [
                    {
                      conditions: {
                        condition: 'state',
                        entity_id: motions[0].entity_id,
                        state: 'on'
                      },
                      sequence: {
                        service: 'light.turn_on',
                        target: { entity_id: lights.map(l => l.entity_id) }
                      }
                    },
                    {
                      conditions: {
                        condition: 'state',
                        entity_id: motions[0].entity_id,
                        state: 'off'
                      },
                      sequence: {
                        service: 'light.turn_off',
                        target: { entity_id: lights.map(l => l.entity_id) }
                      }
                    }
                  ]
                }
              ],
              mode: 'restart'
            }
          });
        }
      }
    });

    // 2. CLIMATE PRESENCE CONTROL
    if (entityGroups.climateDevices.length > 0 && entityGroups.presenceSensors.length > 0) {
      const automationName = 'Smart Climate Presence Control';
      if (!automationExists(automationName)) {
        suggestions.push({
          id: 'climate_presence',
          title: automationName,
          description: 'Automatically adjust temperature when nobody is home to save energy',
          category: 'energy',
          priority: 'high',
          impact: '$25-40/month savings',
          estimatedSavings: 35,
          requiredEntities: [entityGroups.climateDevices[0].entity_id, entityGroups.presenceSensors[0].entity_id],
          tags: ['energy', 'climate', 'presence', 'savings'],
          automation: {
            alias: automationName,
            description: 'Energy-saving climate control based on home occupancy',
            trigger: [
              {
                platform: 'state',
                entity_id: entityGroups.presenceSensors[0].entity_id,
                to: 'not_home',
                for: '00:30:00'
              },
              {
                platform: 'state',
                entity_id: entityGroups.presenceSensors[0].entity_id,
                to: 'home'
              }
            ],
            action: [
              {
                choose: [
                  {
                    conditions: {
                      condition: 'state',
                      entity_id: entityGroups.presenceSensors[0].entity_id,
                      state: 'not_home'
                    },
                    sequence: {
                      service: 'climate.set_temperature',
                      target: { entity_id: entityGroups.climateDevices[0].entity_id },
                      data: { temperature: 18 }
                    }
                  },
                  {
                    conditions: {
                      condition: 'state',
                      entity_id: entityGroups.presenceSensors[0].entity_id,
                      state: 'home'
                    },
                    sequence: {
                      service: 'climate.set_temperature',
                      target: { entity_id: entityGroups.climateDevices[0].entity_id },
                      data: { temperature: 22 }
                    }
                  }
                ]
              }
            ],
            mode: 'restart'
          }
        });
      }
    }

    // 3. SECURITY DOOR/WINDOW ALERTS
    [...entityGroups.doorSensors, ...entityGroups.windowSensors].forEach(sensor => {
      const sensorType = sensor.entity_id.includes('door') ? 'Door' : 'Window';
      const area = extractArea(sensor.entity_id);
      const automationName = `${sensorType} Security Alert - ${area.charAt(0).toUpperCase() + area.slice(1)}`;
      
      if (!automationExists(automationName) && area !== 'unknown') {
        suggestions.push({
          id: `security_${sensor.entity_id.replace('.', '_')}`,
          title: automationName,
          description: `Get notified when ${area} ${sensorType.toLowerCase()} opens during night hours or when away`,
          category: 'security',
          priority: 'high',
          impact: 'Enhanced security monitoring',
          requiredEntities: [sensor.entity_id],
          tags: ['security', 'notifications', sensorType.toLowerCase(), area],
          automation: {
            alias: automationName,
            description: `Security monitoring for ${area} ${sensorType.toLowerCase()}`,
            trigger: {
              platform: 'state',
              entity_id: sensor.entity_id,
              to: 'on'
            },
            condition: {
              condition: 'or',
              conditions: [
                {
                  condition: 'time',
                  after: '22:00:00',
                  before: '06:00:00'
                },
                ...(entityGroups.presenceSensors.length > 0 ? [{
                  condition: 'state',
                  entity_id: entityGroups.presenceSensors[0].entity_id,
                  state: 'not_home'
                }] : [])
              ]
            },
            action: {
              service: 'notify.persistent_notification',
              data: {
                title: 'Security Alert',
                message: `${area.charAt(0).toUpperCase() + area.slice(1)} ${sensorType.toLowerCase()} opened at {{ now().strftime("%H:%M") }}`
              }
            },
            mode: 'single'
          }
        });
      }
    });

    // 4. AUTOMATIC LOCK CONTROL
    if (entityGroups.locks.length > 0 && entityGroups.presenceSensors.length > 0) {
      entityGroups.locks.forEach(lock => {
        const area = extractArea(lock.entity_id);
        const automationName = `Auto Lock - ${area.charAt(0).toUpperCase() + area.slice(1)}`;
        
        if (!automationExists(automationName)) {
          suggestions.push({
            id: `auto_lock_${lock.entity_id.replace('.', '_')}`,
            title: automationName,
            description: `Automatically lock ${area} when everyone leaves home`,
            category: 'security',
            priority: 'medium',
            impact: 'Improved security',
            requiredEntities: [lock.entity_id, entityGroups.presenceSensors[0].entity_id],
            tags: ['security', 'locks', 'automation', area],
            automation: {
              alias: automationName,
              description: `Auto-lock ${area} when home becomes empty`,
              trigger: {
                platform: 'state',
                entity_id: entityGroups.presenceSensors[0].entity_id,
                to: 'not_home',
                for: '00:05:00'
              },
              condition: {
                condition: 'state',
                entity_id: lock.entity_id,
                state: 'unlocked'
              },
              action: {
                service: 'lock.lock',
                target: { entity_id: lock.entity_id }
              },
              mode: 'single'
            }
          });
        }
      });
    }

    // 5. COVER/BLIND AUTOMATION
    if (entityGroups.covers.length > 0) {
      entityGroups.covers.forEach(cover => {
        const area = extractArea(cover.entity_id);
        const automationName = `Smart Blinds - ${area.charAt(0).toUpperCase() + area.slice(1)}`;
        
        if (!automationExists(automationName) && area !== 'unknown') {
          suggestions.push({
            id: `smart_covers_${cover.entity_id.replace('.', '_')}`,
            title: automationName,
            description: `Open ${area} blinds at sunrise, close at sunset for energy efficiency`,
            category: 'comfort',
            priority: 'low',
            impact: 'Energy efficiency & comfort',
            requiredEntities: [cover.entity_id],
            tags: ['comfort', 'energy', 'covers', area],
            automation: {
              alias: automationName,
              description: `Automated ${area} blind control based on sun position`,
              trigger: [
                {
                  platform: 'sun',
                  event: 'sunrise',
                  offset: '00:30:00'
                },
                {
                  platform: 'sun',
                  event: 'sunset',
                  offset: '-00:30:00'
                }
              ],
              action: {
                choose: [
                  {
                    conditions: {
                      condition: 'sun',
                      after: 'sunrise'
                    },
                    sequence: {
                      service: 'cover.open_cover',
                      target: { entity_id: cover.entity_id }
                    }
                  },
                  {
                    conditions: {
                      condition: 'sun',
                      before: 'sunrise'
                    },
                    sequence: {
                      service: 'cover.close_cover',
                      target: { entity_id: cover.entity_id }
                    }
                  }
                ]
              },
              mode: 'single'
            }
          });
        }
      });
    }

    // 6. WATER LEAK DETECTION
    if (entityGroups.waterSensors.length > 0) {
      entityGroups.waterSensors.forEach(sensor => {
        const area = extractArea(sensor.entity_id);
        const automationName = `Water Leak Alert - ${area.charAt(0).toUpperCase() + area.slice(1)}`;
        
        if (!automationExists(automationName)) {
          suggestions.push({
            id: `water_leak_${sensor.entity_id.replace('.', '_')}`,
            title: automationName,
            description: `Immediate alert when water leak detected in ${area}`,
            category: 'maintenance',
            priority: 'critical',
            impact: 'Prevent water damage',
            requiredEntities: [sensor.entity_id],
            tags: ['safety', 'water', 'leak', 'emergency', area],
            automation: {
              alias: automationName,
              description: `Emergency water leak detection for ${area}`,
              trigger: {
                platform: 'state',
                entity_id: sensor.entity_id,
                to: 'on'
              },
              action: [
                {
                  service: 'notify.persistent_notification',
                  data: {
                    title: '🚨 WATER LEAK DETECTED',
                    message: `Water leak detected in ${area}! Check immediately.`
                  }
                }
              ],
              mode: 'single'
            }
          });
        }
      });
    }

    // 7. SMOKE DETECTION ALERTS
    if (entityGroups.smokeSensors.length > 0) {
      entityGroups.smokeSensors.forEach(sensor => {
        const area = extractArea(sensor.entity_id);
        const automationName = `Smoke Alert - ${area.charAt(0).toUpperCase() + area.slice(1)}`;
        
        if (!automationExists(automationName)) {
          suggestions.push({
            id: `smoke_alert_${sensor.entity_id.replace('.', '_')}`,
            title: automationName,
            description: `Emergency smoke detection alert for ${area}`,
            category: 'security',
            priority: 'critical',
            impact: 'Fire safety',
            requiredEntities: [sensor.entity_id],
            tags: ['safety', 'smoke', 'fire', 'emergency', area],
            automation: {
              alias: automationName,
              description: `Emergency smoke detection for ${area}`,
              trigger: {
                platform: 'state',
                entity_id: sensor.entity_id,
                to: 'on'
              },
              action: [
                {
                  service: 'notify.persistent_notification',
                  data: {
                    title: '🔥 SMOKE DETECTED',
                    message: `Smoke detected in ${area}! Emergency response required.`
                  }
                },
                ...(entityGroups.lights.length > 0 ? [{
                  service: 'light.turn_on',
                  target: { entity_id: entityGroups.lights.map(l => l.entity_id) },
                  data: { brightness: 255 }
                }] : [])
              ],
              mode: 'single'
            }
          });
        }
      });
    }

    // 8. TEMPERATURE-BASED AUTOMATION
    if (entityGroups.temperatureSensors.length > 0 && entityGroups.climateDevices.length > 0) {
      entityGroups.temperatureSensors.forEach(tempSensor => {
        const area = extractArea(tempSensor.entity_id);
        const matchingClimate = entityGroups.climateDevices.find(climate => 
          extractArea(climate.entity_id) === area
        );
        
        if (matchingClimate) {
          const automationName = `Smart Temperature Control - ${area.charAt(0).toUpperCase() + area.slice(1)}`;
          
          if (!automationExists(automationName)) {
            suggestions.push({
              id: `temp_control_${area}`,
              title: automationName,
              description: `Automatically adjust ${area} climate based on actual temperature readings`,
              category: 'comfort',
              priority: 'medium',
              impact: 'Improved comfort & efficiency',
              estimatedSavings: 15,
              requiredEntities: [tempSensor.entity_id, matchingClimate.entity_id],
              tags: ['comfort', 'temperature', 'climate', area],
              automation: {
                alias: automationName,
                description: `Temperature-based climate control for ${area}`,
                trigger: {
                  platform: 'numeric_state',
                  entity_id: tempSensor.entity_id,
                  above: 25
                },
                condition: {
                  condition: 'state',
                  entity_id: matchingClimate.entity_id,
                  state: 'heat'
                },
                action: {
                  service: 'climate.set_temperature',
                  target: { entity_id: matchingClimate.entity_id },
                  data: { temperature: 22 }
                },
                mode: 'single'
              }
            });
          }
        }
      });
    }

    // 9. HUMIDITY CONTROL
    if (entityGroups.humiditySensors.length > 0 && entityGroups.switches.length > 0) {
      entityGroups.humiditySensors.forEach(humiditySensor => {
        const area = extractArea(humiditySensor.entity_id);
        const matchingFan = entityGroups.switches.find(sw => 
          (sw.entity_id.includes('fan') || sw.entity_id.includes('exhaust')) &&
          extractArea(sw.entity_id) === area
        );
        
        if (matchingFan) {
          const automationName = `Humidity Control - ${area.charAt(0).toUpperCase() + area.slice(1)}`;
          
          if (!automationExists(automationName)) {
            suggestions.push({
              id: `humidity_control_${area}`,
              title: automationName,
              description: `Turn on ${area} fan when humidity is too high`,
              category: 'comfort',
              priority: 'low',
              impact: 'Prevent mold & improve air quality',
              requiredEntities: [humiditySensor.entity_id, matchingFan.entity_id],
              tags: ['comfort', 'humidity', 'air quality', area],
              automation: {
                alias: automationName,
                description: `Automatic humidity control for ${area}`,
                trigger: [
                  {
                    platform: 'numeric_state',
                    entity_id: humiditySensor.entity_id,
                    above: 70
                  },
                  {
                    platform: 'numeric_state',
                    entity_id: humiditySensor.entity_id,
                    below: 60
                  }
                ],
                action: {
                  choose: [
                    {
                      conditions: {
                        condition: 'numeric_state',
                        entity_id: humiditySensor.entity_id,
                        above: 70
                      },
                      sequence: {
                        service: 'switch.turn_on',
                        target: { entity_id: matchingFan.entity_id }
                      }
                    },
                    {
                      conditions: {
                        condition: 'numeric_state',
                        entity_id: humiditySensor.entity_id,
                        below: 60
                      },
                      sequence: {
                        service: 'switch.turn_off',
                        target: { entity_id: matchingFan.entity_id }
                      }
                    }
                  ]
                },
                mode: 'restart'
              }
            });
          }
        }
      });
    }

    // 10. GOODNIGHT ROUTINE
    if (entityGroups.lights.length > 0 && entityGroups.locks.length > 0) {
      const automationName = 'Goodnight Routine';
      
      if (!automationExists(automationName)) {
        suggestions.push({
          id: 'goodnight_routine',
          title: automationName,
          description: 'Turn off all lights and lock doors with a single button press',
          category: 'convenience',
          priority: 'low',
          impact: 'Convenience & security',
          requiredEntities: [...entityGroups.lights.slice(0, 3).map(l => l.entity_id), ...entityGroups.locks.slice(0, 2).map(l => l.entity_id)],
          tags: ['convenience', 'routine', 'security', 'lights'],
          automation: {
            alias: automationName,
            description: 'Complete goodnight routine automation',
            trigger: {
              platform: 'time',
              at: '23:00:00'
            },
            action: [
              {
                service: 'light.turn_off',
                target: { entity_id: entityGroups.lights.map(l => l.entity_id) }
              },
              {
                service: 'lock.lock',
                target: { entity_id: entityGroups.locks.map(l => l.entity_id) }
              },
              ...(entityGroups.climateDevices.length > 0 ? [{
                service: 'climate.set_temperature',
                target: { entity_id: entityGroups.climateDevices.map(c => c.entity_id) },
                data: { temperature: 20 }
              }] : [])
            ],
            mode: 'single'
          }
        });
      }
    }

    console.log(`✅ Generated ${suggestions.length} automation suggestions based on entity analysis`);
    return suggestions;
  }

  // Convert automation to YAML format for display
  automationToYaml(automation: HomeAssistantAutomation): string {
    const yamlLines: string[] = [];
    
    yamlLines.push(`alias: "${automation.alias}"`);
    
    if (automation.description) {
      yamlLines.push(`description: "${automation.description}"`);
    }
    
    // Triggers
    yamlLines.push('trigger:');
    const triggers = Array.isArray(automation.trigger) ? automation.trigger : [automation.trigger];
    triggers.forEach((trigger, index) => {
      if (index === 0) {
        yamlLines.push(`  - platform: ${trigger.platform}`);
      } else {
        yamlLines.push(`  - platform: ${trigger.platform}`);
      }
      
      Object.entries(trigger).forEach(([key, value]) => {
        if (key !== 'platform') {
          yamlLines.push(`    ${key}: ${typeof value === 'string' ? `"${value}"` : value}`);
        }
      });
    });
    
    // Conditions
    if (automation.condition) {
      yamlLines.push('condition:');
      const conditions = Array.isArray(automation.condition) ? automation.condition : [automation.condition];
      conditions.forEach((condition, index) => {
        yamlLines.push(`  - condition: ${condition.condition}`);
        Object.entries(condition).forEach(([key, value]) => {
          if (key !== 'condition') {
            yamlLines.push(`    ${key}: ${typeof value === 'string' ? `"${value}"` : value}`);
          }
        });
      });
    }
    
    // Actions
    yamlLines.push('action:');
    const actions = Array.isArray(automation.action) ? automation.action : [automation.action];
    actions.forEach((action, index) => {
      if (action.service) {
        yamlLines.push(`  - service: ${action.service}`);
        if (action.target) {
          yamlLines.push('    target:');
          Object.entries(action.target).forEach(([key, value]) => {
            yamlLines.push(`      ${key}: ${typeof value === 'string' ? `"${value}"` : JSON.stringify(value)}`);
          });
        }
        if (action.data) {
          yamlLines.push('    data:');
          Object.entries(action.data).forEach(([key, value]) => {
            yamlLines.push(`      ${key}: ${typeof value === 'string' ? `"${value}"` : value}`);
          });
        }
      }
    });
    
    if (automation.mode) {
      yamlLines.push(`mode: ${automation.mode}`);
    }
    
    return yamlLines.join('\n');
  }
}

// Export singleton instance
export const homeAssistantAutomationService = new HomeAssistantAutomationService();
export type { 
  HomeAssistantAutomation, 
  AutomationSuggestion, 
  AutomationValidationResult,
  AutomationTrigger,
  AutomationCondition,
  AutomationAction
}; 