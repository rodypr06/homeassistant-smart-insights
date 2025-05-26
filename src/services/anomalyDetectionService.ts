interface SensorReading {
  timestamp: string;
  entity_id: string;
  value: number;
  state: string;
}

interface AnomalyDetectionConfig {
  zScoreThreshold: number;
  iqrMultiplier: number;
  minDataPoints: number;
  excludeStates: string[];
  excludeDomains: string[];
  requireDailyReporting: boolean;
}

interface DetectedAnomaly {
  id: string;
  timestamp: string;
  entityId: string;
  value: number;
  expectedValue: number;
  deviation: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'spike' | 'drop' | 'pattern' | 'missing' | 'stuck';
  description: string;
  confidence: number;
  method: 'z-score' | 'iqr' | 'pattern' | 'missing-data';
}

interface EntityStats {
  entityId: string;
  mean: number;
  median: number;
  stdDev: number;
  q1: number;
  q3: number;
  iqr: number;
  dataPoints: number;
  lastReporting: string;
  reportingFrequency: number; // readings per day
  isHealthy: boolean;
}

class AnomalyDetectionService {
  private config: AnomalyDetectionConfig = {
    zScoreThreshold: 2.5,
    iqrMultiplier: 1.5,
    minDataPoints: 5, // Reduced from 10 to be less strict
    excludeStates: [
      'unknown', 'unavailable', 'disabled', 'none', 'null', 
      'error', 'timeout', 'disconnected', 'offline', 'fault'
    ],
    excludeDomains: [
      'automation', 'script', 'scene', 'group', 'zone', 
      'device_tracker', 'person', 'input_boolean', 'input_select',
      'input_text', 'input_number', 'input_datetime', 'timer',
      'counter', 'weather'
    ],
    requireDailyReporting: false // Disabled to be less strict initially
  };

  // Filter and validate sensor data
  private filterValidData(data: SensorReading[]): SensorReading[] {
    console.log(`🔍 Filtering ${data.length} raw data points...`);
    
    // Log sample of raw data for debugging
    if (data.length > 0) {
      console.log('📊 Sample raw data:', data.slice(0, 3));
    }
    
    const filtered = data.filter(reading => {
      // Exclude problematic states
      if (reading.state && this.config.excludeStates.includes(reading.state.toLowerCase())) {
        return false;
      }

      // Exclude non-sensor domains
      const domain = reading.entity_id?.split('.')[0];
      if (domain && this.config.excludeDomains.includes(domain)) {
        return false;
      }

      // Ensure numeric value
      const numericValue = this.parseNumericValue(reading.value, reading.state);
      if (numericValue === null) {
        return false;
      }

      // Update the reading with parsed numeric value
      reading.value = numericValue;

      return true;
    });

    console.log(`✅ Filtered to ${filtered.length} valid data points`);
    
    // Log sample of filtered data for debugging
    if (filtered.length > 0) {
      console.log('📊 Sample filtered data:', filtered.slice(0, 3));
    }
    
    return filtered;
  }

  // Parse numeric values from various formats
  private parseNumericValue(value: any, state: string): number | null {
    // Try direct numeric conversion
    if (typeof value === 'number' && !isNaN(value)) {
      return value;
    }

    // Try parsing string value
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }

    // Try parsing state as numeric
    if (typeof state === 'string') {
      const parsed = parseFloat(state);
      if (!isNaN(parsed)) {
        return parsed;
      }

      // Handle common state values
      switch (state.toLowerCase()) {
        case 'on': return 1;
        case 'off': return 0;
        case 'open': return 1;
        case 'closed': return 0;
        case 'home': return 1;
        case 'away': return 0;
        case 'true': return 1;
        case 'false': return 0;
        default: return null;
      }
    }

    return null;
  }

  // Check if entity reports daily
  private checkDailyReporting(readings: SensorReading[]): boolean {
    if (readings.length === 0) return false;

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentReadings = readings.filter(r => 
      new Date(r.timestamp) > oneDayAgo
    );

    // Require at least 4 readings per day (every 6 hours)
    return recentReadings.length >= 4;
  }

  // Calculate statistical metrics for an entity
  private calculateEntityStats(readings: SensorReading[]): EntityStats {
    const values = readings.map(r => r.value).sort((a, b) => a - b);
    const n = values.length;

    if (n === 0) {
      throw new Error('No valid readings for entity');
    }

    // Basic statistics
    const mean = values.reduce((sum, val) => sum + val, 0) / n;
    const median = n % 2 === 0 
      ? (values[n/2 - 1] + values[n/2]) / 2 
      : values[Math.floor(n/2)];

    // Standard deviation
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    // Quartiles and IQR
    const q1Index = Math.floor(n * 0.25);
    const q3Index = Math.floor(n * 0.75);
    const q1 = values[q1Index];
    const q3 = values[q3Index];
    const iqr = q3 - q1;

    // Reporting frequency
    const timeSpan = new Date(readings[readings.length - 1].timestamp).getTime() - 
                    new Date(readings[0].timestamp).getTime();
    const days = timeSpan / (24 * 60 * 60 * 1000);
    const reportingFrequency = readings.length / Math.max(days, 1);

    const isHealthy = this.config.requireDailyReporting 
      ? this.checkDailyReporting(readings)
      : readings.length >= this.config.minDataPoints;

    return {
      entityId: readings[0].entity_id,
      mean,
      median,
      stdDev,
      q1,
      q3,
      iqr,
      dataPoints: n,
      lastReporting: readings[readings.length - 1].timestamp,
      reportingFrequency,
      isHealthy
    };
  }

  // Detect anomalies using Z-Score method
  private detectZScoreAnomalies(readings: SensorReading[], stats: EntityStats): DetectedAnomaly[] {
    const anomalies: DetectedAnomaly[] = [];

    readings.forEach(reading => {
      if (stats.stdDev === 0) return; // Skip if no variation

      const zScore = Math.abs(reading.value - stats.mean) / stats.stdDev;
      
      if (zScore > this.config.zScoreThreshold) {
        const severity = this.calculateSeverity(zScore, 'z-score');
        const type = reading.value > stats.mean ? 'spike' : 'drop';
        
        anomalies.push({
          id: `zscore_${reading.entity_id}_${reading.timestamp}`,
          timestamp: reading.timestamp,
          entityId: reading.entity_id,
          value: reading.value,
          expectedValue: stats.mean,
          deviation: Math.abs(reading.value - stats.mean),
          severity,
          type,
          description: this.generateDescription(type, severity, reading.entity_id, reading.value, stats.mean),
          confidence: Math.min(zScore / this.config.zScoreThreshold, 1),
          method: 'z-score'
        });
      }
    });

    return anomalies;
  }

  // Detect anomalies using IQR method
  private detectIQRAnomalies(readings: SensorReading[], stats: EntityStats): DetectedAnomaly[] {
    const anomalies: DetectedAnomaly[] = [];

    const lowerBound = stats.q1 - (this.config.iqrMultiplier * stats.iqr);
    const upperBound = stats.q3 + (this.config.iqrMultiplier * stats.iqr);

    readings.forEach(reading => {
      if (reading.value < lowerBound || reading.value > upperBound) {
        const deviation = reading.value < lowerBound 
          ? lowerBound - reading.value 
          : reading.value - upperBound;
        
        const severity = this.calculateSeverity(deviation / stats.iqr, 'iqr');
        const type = reading.value > upperBound ? 'spike' : 'drop';
        
        anomalies.push({
          id: `iqr_${reading.entity_id}_${reading.timestamp}`,
          timestamp: reading.timestamp,
          entityId: reading.entity_id,
          value: reading.value,
          expectedValue: stats.median,
          deviation,
          severity,
          type,
          description: this.generateDescription(type, severity, reading.entity_id, reading.value, stats.median),
          confidence: Math.min(deviation / (stats.iqr * this.config.iqrMultiplier), 1),
          method: 'iqr'
        });
      }
    });

    return anomalies;
  }

  // Detect missing data patterns
  private detectMissingDataAnomalies(readings: SensorReading[], entityId: string): DetectedAnomaly[] {
    const anomalies: DetectedAnomaly[] = [];
    
    if (readings.length < 2) return anomalies;

    // Sort by timestamp
    const sortedReadings = [...readings].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Calculate average interval between readings
    const intervals = [];
    for (let i = 1; i < sortedReadings.length; i++) {
      const interval = new Date(sortedReadings[i].timestamp).getTime() - 
                      new Date(sortedReadings[i-1].timestamp).getTime();
      intervals.push(interval);
    }

    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const expectedInterval = avgInterval * 3; // Allow 3x normal interval

    // Detect gaps
    for (let i = 1; i < sortedReadings.length; i++) {
      const actualInterval = new Date(sortedReadings[i].timestamp).getTime() - 
                            new Date(sortedReadings[i-1].timestamp).getTime();
      
      if (actualInterval > expectedInterval) {
        const gapHours = actualInterval / (60 * 60 * 1000);
        
        anomalies.push({
          id: `missing_${entityId}_${sortedReadings[i-1].timestamp}`,
          timestamp: sortedReadings[i-1].timestamp,
          entityId,
          value: 0,
          expectedValue: 1,
          deviation: gapHours,
          severity: gapHours > 24 ? 'high' : gapHours > 6 ? 'medium' : 'low',
          type: 'missing',
          description: `Data gap detected: ${gapHours.toFixed(1)} hours without readings`,
          confidence: Math.min(actualInterval / expectedInterval - 1, 1),
          method: 'missing-data'
        });
      }
    }

    return anomalies;
  }

  // Detect stuck sensor values
  private detectStuckValues(readings: SensorReading[]): DetectedAnomaly[] {
    const anomalies: DetectedAnomaly[] = [];
    
    if (readings.length < 5) return anomalies;

    // Sort by timestamp
    const sortedReadings = [...readings].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let consecutiveCount = 1;
    let currentValue = sortedReadings[0].value;

    for (let i = 1; i < sortedReadings.length; i++) {
      if (sortedReadings[i].value === currentValue) {
        consecutiveCount++;
      } else {
        // Check if we had too many consecutive identical values
        if (consecutiveCount >= 10) { // 10+ identical readings
          const timeSpan = new Date(sortedReadings[i-1].timestamp).getTime() - 
                          new Date(sortedReadings[i-consecutiveCount].timestamp).getTime();
          const hours = timeSpan / (60 * 60 * 1000);

          anomalies.push({
            id: `stuck_${sortedReadings[0].entity_id}_${sortedReadings[i-consecutiveCount].timestamp}`,
            timestamp: sortedReadings[i-consecutiveCount].timestamp,
            entityId: sortedReadings[0].entity_id,
            value: currentValue,
            expectedValue: currentValue, // Expected to change
            deviation: consecutiveCount,
            severity: hours > 24 ? 'high' : hours > 6 ? 'medium' : 'low',
            type: 'stuck',
            description: `Sensor stuck at value ${currentValue} for ${hours.toFixed(1)} hours (${consecutiveCount} readings)`,
            confidence: Math.min(consecutiveCount / 20, 1),
            method: 'pattern'
          });
        }

        consecutiveCount = 1;
        currentValue = sortedReadings[i].value;
      }
    }

    return anomalies;
  }

  // Calculate severity based on deviation and method
  private calculateSeverity(deviation: number, method: 'z-score' | 'iqr'): 'low' | 'medium' | 'high' | 'critical' {
    if (method === 'z-score') {
      if (deviation > 4) return 'critical';
      if (deviation > 3.5) return 'high';
      if (deviation > 3) return 'medium';
      return 'low';
    } else { // IQR
      if (deviation > 3) return 'critical';
      if (deviation > 2.5) return 'high';
      if (deviation > 2) return 'medium';
      return 'low';
    }
  }

  // Generate human-readable descriptions
  private generateDescription(type: string, severity: string, entityId: string, value: number, expected: number): string {
    const entityName = entityId.replace(/^(sensor|binary_sensor|switch|light)\./, '').replace(/_/g, ' ');
    const deviation = Math.abs(value - expected);
    const percentChange = expected !== 0 ? ((value - expected) / expected * 100).toFixed(1) : 'N/A';

    switch (type) {
      case 'spike':
        return `${entityName} spiked to ${value.toFixed(2)} (expected ~${expected.toFixed(2)}, +${percentChange}% change)`;
      case 'drop':
        return `${entityName} dropped to ${value.toFixed(2)} (expected ~${expected.toFixed(2)}, ${percentChange}% change)`;
      case 'missing':
        return `${entityName} stopped reporting data`;
      case 'stuck':
        return `${entityName} sensor appears stuck at ${value}`;
      default:
        return `${entityName} anomaly detected: ${value.toFixed(2)} vs expected ${expected.toFixed(2)}`;
    }
  }

  // Main anomaly detection function
  async detectAnomalies(data: SensorReading[]): Promise<{
    anomalies: DetectedAnomaly[];
    entityStats: EntityStats[];
    summary: {
      totalEntities: number;
      healthyEntities: number;
      totalAnomalies: number;
      criticalAnomalies: number;
      highSeverityAnomalies: number;
      detectionMethods: Record<string, number>;
    };
  }> {
    console.log(`🔍 Starting anomaly detection on ${data.length} data points...`);

    // Filter valid data
    const validData = this.filterValidData(data);
    
    if (validData.length === 0) {
      console.warn('⚠️ No valid data points found for anomaly detection');
      return {
        anomalies: [],
        entityStats: [],
        summary: {
          totalEntities: 0,
          healthyEntities: 0,
          totalAnomalies: 0,
          criticalAnomalies: 0,
          highSeverityAnomalies: 0,
          detectionMethods: {}
        }
      };
    }

    // Group data by entity
    const entitiesData = validData.reduce((acc, reading) => {
      if (!acc[reading.entity_id]) {
        acc[reading.entity_id] = [];
      }
      acc[reading.entity_id].push(reading);
      return acc;
    }, {} as Record<string, SensorReading[]>);

    console.log(`📊 Analyzing ${Object.keys(entitiesData).length} entities...`);

    const allAnomalies: DetectedAnomaly[] = [];
    const entityStats: EntityStats[] = [];

    // Analyze each entity
    for (const [entityId, readings] of Object.entries(entitiesData)) {
      try {
        // Skip entities with insufficient data
        if (readings.length < this.config.minDataPoints) {
          console.log(`⏭️ Skipping ${entityId}: insufficient data (${readings.length} points)`);
          continue;
        }

        // Calculate statistics
        const stats = this.calculateEntityStats(readings);
        entityStats.push(stats);

        // Skip unhealthy entities if required
        if (this.config.requireDailyReporting && !stats.isHealthy) {
          console.log(`⏭️ Skipping ${entityId}: not reporting daily`);
          continue;
        }

        console.log(`🔬 Analyzing ${entityId}: ${stats.dataPoints} points, μ=${stats.mean.toFixed(2)}, σ=${stats.stdDev.toFixed(2)}`);

        // Detect anomalies using multiple methods
        const zScoreAnomalies = this.detectZScoreAnomalies(readings, stats);
        const iqrAnomalies = this.detectIQRAnomalies(readings, stats);
        const missingDataAnomalies = this.detectMissingDataAnomalies(readings, entityId);
        const stuckValueAnomalies = this.detectStuckValues(readings);

        allAnomalies.push(...zScoreAnomalies, ...iqrAnomalies, ...missingDataAnomalies, ...stuckValueAnomalies);

      } catch (error) {
        console.error(`❌ Error analyzing ${entityId}:`, error);
      }
    }

    // Remove duplicate anomalies (same entity, similar timestamp)
    const uniqueAnomalies = this.deduplicateAnomalies(allAnomalies);

    // Sort by severity and timestamp
    uniqueAnomalies.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    // Generate summary
    const summary = {
      totalEntities: entityStats.length,
      healthyEntities: entityStats.filter(s => s.isHealthy).length,
      totalAnomalies: uniqueAnomalies.length,
      criticalAnomalies: uniqueAnomalies.filter(a => a.severity === 'critical').length,
      highSeverityAnomalies: uniqueAnomalies.filter(a => a.severity === 'high').length,
      detectionMethods: uniqueAnomalies.reduce((acc, anomaly) => {
        acc[anomaly.method] = (acc[anomaly.method] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

    console.log(`✅ Anomaly detection complete: ${uniqueAnomalies.length} anomalies found across ${entityStats.length} entities`);

    return {
      anomalies: uniqueAnomalies,
      entityStats,
      summary
    };
  }

  // Remove duplicate anomalies
  private deduplicateAnomalies(anomalies: DetectedAnomaly[]): DetectedAnomaly[] {
    const seen = new Set<string>();
    return anomalies.filter(anomaly => {
      const key = `${anomaly.entityId}_${anomaly.type}_${Math.floor(new Date(anomaly.timestamp).getTime() / (60 * 60 * 1000))}`; // Group by entity, type, and hour
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  // Update configuration
  updateConfig(newConfig: Partial<AnomalyDetectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🔧 Anomaly detection configuration updated:', this.config);
  }

  // Get current configuration
  getConfig(): AnomalyDetectionConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const anomalyDetectionService = new AnomalyDetectionService();
export type { DetectedAnomaly, EntityStats, AnomalyDetectionConfig, SensorReading }; 