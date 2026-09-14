#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class PerformanceOptimizer {
  constructor() {
    this.projectRoot = process.cwd();
    this.reportsDir = path.join(this.projectRoot, 'performance-reports');
  }

  async run() {
    console.log('🚀 Starting Performance Optimization Analysis...\n');

    // Create reports directory
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir);
    }

    try {
      await this.analyzeBundleSize();
      await this.checkMemoryLeaks();
      await this.analyzeDependencies();
      await this.generateReport();
      
      console.log('\n✅ Performance analysis completed!');
      console.log(`📊 Reports saved to: ${this.reportsDir}`);
    } catch (error) {
      console.error('❌ Error during analysis:', error.message);
      process.exit(1);
    }
  }

  async analyzeBundleSize() {
    console.log('📦 Analyzing bundle size...');
    
    try {
      // Build with stats
      execSync('npm run build:prod -- --stats-json', { stdio: 'pipe' });
      
      const statsPath = path.join(this.projectRoot, 'dist/vitality/stats.json');
      if (fs.existsSync(statsPath)) {
        const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
        
        const bundleAnalysis = {
          timestamp: new Date().toISOString(),
          totalSize: this.formatBytes(this.calculateTotalSize(stats)),
          chunks: this.analyzeChunks(stats),
          recommendations: this.generateBundleRecommendations(stats)
        };

        fs.writeFileSync(
          path.join(this.reportsDir, 'bundle-analysis.json'),
          JSON.stringify(bundleAnalysis, null, 2)
        );

        console.log(`   Total bundle size: ${bundleAnalysis.totalSize}`);
      }
    } catch (error) {
      console.log('   ⚠️  Bundle analysis failed, continuing...');
    }
  }

  async checkMemoryLeaks() {
    console.log('🔍 Checking for potential memory leaks...');
    
    const memoryLeakReport = {
      timestamp: new Date().toISOString(),
      potentialIssues: [],
      recommendations: []
    };

    // Check for common memory leak patterns
    const sourceFiles = this.findTypeScriptFiles();
    
    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const issues = this.analyzeFileForMemoryLeaks(content, file);
      memoryLeakReport.potentialIssues.push(...issues);
    }

    // Generate recommendations
    memoryLeakReport.recommendations = this.generateMemoryLeakRecommendations(memoryLeakReport.potentialIssues);

    fs.writeFileSync(
      path.join(this.reportsDir, 'memory-leak-analysis.json'),
      JSON.stringify(memoryLeakReport, null, 2)
    );

    console.log(`   Found ${memoryLeakReport.potentialIssues.length} potential issues`);
  }

  async analyzeDependencies() {
    console.log('📋 Analyzing dependencies...');
    
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const dependencyAnalysis = {
        timestamp: new Date().toISOString(),
        totalDependencies: Object.keys(packageJson.dependencies || {}).length,
        totalDevDependencies: Object.keys(packageJson.devDependencies || {}).length,
        largeDependencies: this.findLargeDependencies(),
        recommendations: this.generateDependencyRecommendations(packageJson)
      };

      fs.writeFileSync(
        path.join(this.reportsDir, 'dependency-analysis.json'),
        JSON.stringify(dependencyAnalysis, null, 2)
      );

      console.log(`   Total dependencies: ${dependencyAnalysis.totalDependencies}`);
    } catch (error) {
      console.log('   ⚠️  Dependency analysis failed');
    }
  }

  async generateReport() {
    console.log('📊 Generating performance report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        bundleSize: this.getBundleSizeInfo(),
        memoryLeaks: this.getMemoryLeakInfo(),
        dependencies: this.getDependencyInfo()
      },
      recommendations: this.getOverallRecommendations(),
      nextSteps: [
        'Run npm run performance:audit for detailed Lighthouse analysis',
        'Review bundle-analysis.json for optimization opportunities',
        'Check memory-leak-analysis.json for potential issues',
        'Consider implementing lazy loading for large modules'
      ]
    };

    fs.writeFileSync(
      path.join(this.reportsDir, 'performance-report.json'),
      JSON.stringify(report, null, 2)
    );

    // Generate markdown report
    const markdownReport = this.generateMarkdownReport(report);
    fs.writeFileSync(
      path.join(this.reportsDir, 'performance-report.md'),
      markdownReport
    );
  }

  // Helper methods
  findTypeScriptFiles(dir = 'src') {
    const files = [];
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        files.push(...this.findTypeScriptFiles(fullPath));
      } else if (item.endsWith('.ts') && !item.endsWith('.spec.ts')) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  analyzeFileForMemoryLeaks(content, filePath) {
    const issues = [];
    
    // Check for unsubscribed observables
    const subscribeMatches = content.match(/\.subscribe\(/g);
    const takeUntilMatches = content.match(/takeUntil\(/g);
    
    if (subscribeMatches && (!takeUntilMatches || subscribeMatches.length > takeUntilMatches.length)) {
      issues.push({
        type: 'unsubscribed_observable',
        file: filePath,
        severity: 'high',
        description: 'Potential memory leak: Observable subscriptions without takeUntil'
      });
    }

    // Check for missing OnDestroy
    if (content.includes('subscribe(') && !content.includes('OnDestroy')) {
      issues.push({
        type: 'missing_ondestroy',
        file: filePath,
        severity: 'medium',
        description: 'Component with subscriptions should implement OnDestroy'
      });
    }

    // Check for event listeners
    if (content.includes('addEventListener') && !content.includes('removeEventListener')) {
      issues.push({
        type: 'unremoved_event_listener',
        file: filePath,
        severity: 'medium',
        description: 'Event listeners should be removed in ngOnDestroy'
      });
    }

    return issues;
  }

  calculateTotalSize(stats) {
    let totalSize = 0;
    
    // Handle Angular 17+ stats format
    if (stats.outputs) {
      Object.values(stats.outputs).forEach(output => {
        if (output.bytes) {
          totalSize += output.bytes;
        }
      });
    }
    
    // Fallback for old webpack format
    if (stats.assets) {
      stats.assets.forEach(asset => {
        if (asset.name.endsWith('.js') || asset.name.endsWith('.css')) {
          totalSize += asset.size;
        }
      });
    }
    
    return totalSize;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  analyzeChunks(stats) {
    const chunks = [];
    
    // Handle Angular 17+ stats format
    if (stats.outputs) {
      Object.entries(stats.outputs).forEach(([chunkName, output]) => {
        chunks.push({
          name: chunkName,
          size: this.formatBytes(output.bytes || 0),
          modules: output.inputs ? Object.keys(output.inputs).length : 0,
          entryPoint: output.entryPoint || 'unknown'
        });
      });
    }
    
    // Fallback for old webpack format
    if (stats.chunks) {
      stats.chunks.forEach(chunk => {
        chunks.push({
          name: chunk.names[0] || 'unknown',
          size: this.formatBytes(chunk.size),
          modules: chunk.modules ? chunk.modules.length : 0
        });
      });
    }
    
    return chunks;
  }

  generateBundleRecommendations(stats) {
    const recommendations = [];
    
    const totalSize = this.calculateTotalSize(stats);
    if (totalSize > 2 * 1024 * 1024) { // 2MB
      recommendations.push('Bundle size is large. Consider code splitting and lazy loading.');
    }

    // Check chunks count for Angular 17+ format
    if (stats.outputs && Object.keys(stats.outputs).length > 10) {
      recommendations.push('Too many chunks. Consider consolidating small chunks.');
    }
    
    // Fallback for old webpack format
    if (stats.chunks && stats.chunks.length > 10) {
      recommendations.push('Too many chunks. Consider consolidating small chunks.');
    }

    // Check for large individual chunks
    const chunks = this.analyzeChunks(stats);
    const largeChunks = chunks.filter(chunk => {
      const sizeInBytes = this.parseSizeToBytes(chunk.size);
      return sizeInBytes > 500 * 1024; // 500KB
    });
    
    if (largeChunks.length > 0) {
      recommendations.push(`Found ${largeChunks.length} large chunks. Consider splitting them.`);
    }

    return recommendations;
  }

  parseSizeToBytes(sizeString) {
    const match = sizeString.match(/^([\d.]+)\s*(\w+)$/);
    if (!match) return 0;
    
    const [, value, unit] = match;
    const numValue = parseFloat(value);
    
    switch (unit.toLowerCase()) {
      case 'b': return numValue;
      case 'kb': return numValue * 1024;
      case 'mb': return numValue * 1024 * 1024;
      case 'gb': return numValue * 1024 * 1024 * 1024;
      default: return 0;
    }
  }

  generateMemoryLeakRecommendations(issues) {
    const recommendations = [];
    
    const highSeverityIssues = issues.filter(issue => issue.severity === 'high');
    if (highSeverityIssues.length > 0) {
      recommendations.push(`Fix ${highSeverityIssues.length} high-severity memory leak issues.`);
    }

    const unsubscribedIssues = issues.filter(issue => issue.type === 'unsubscribed_observable');
    if (unsubscribedIssues.length > 0) {
      recommendations.push('Implement takeUntil pattern for all Observable subscriptions.');
    }

    return recommendations;
  }

  findLargeDependencies() {
    // This would require analyzing node_modules, simplified for now
    return [];
  }

  generateDependencyRecommendations(packageJson) {
    const recommendations = [];
    
    const deps = Object.keys(packageJson.dependencies || {});
    if (deps.length > 50) {
      recommendations.push('Consider reducing dependencies to improve bundle size.');
    }

    return recommendations;
  }

  getBundleSizeInfo() {
    try {
      const bundleAnalysis = JSON.parse(
        fs.readFileSync(path.join(this.reportsDir, 'bundle-analysis.json'), 'utf8')
      );
      return bundleAnalysis.totalSize;
    } catch {
      return 'Analysis failed';
    }
  }

  getMemoryLeakInfo() {
    try {
      const memoryAnalysis = JSON.parse(
        fs.readFileSync(path.join(this.reportsDir, 'memory-leak-analysis.json'), 'utf8')
      );
      return `${memoryAnalysis.potentialIssues.length} potential issues found`;
    } catch {
      return 'Analysis failed';
    }
  }

  getDependencyInfo() {
    try {
      const depAnalysis = JSON.parse(
        fs.readFileSync(path.join(this.reportsDir, 'dependency-analysis.json'), 'utf8')
      );
      return `${depAnalysis.totalDependencies} dependencies`;
    } catch {
      return 'Analysis failed';
    }
  }

  getOverallRecommendations() {
    const recommendations = [];
    
    try {
      const bundleAnalysis = JSON.parse(
        fs.readFileSync(path.join(this.reportsDir, 'bundle-analysis.json'), 'utf8')
      );
      recommendations.push(...bundleAnalysis.recommendations);
    } catch {}

    try {
      const memoryAnalysis = JSON.parse(
        fs.readFileSync(path.join(this.reportsDir, 'memory-leak-analysis.json'), 'utf8')
      );
      recommendations.push(...memoryAnalysis.recommendations);
    } catch {}

    return recommendations;
  }

  generateMarkdownReport(report) {
    return `# Performance Analysis Report

Generated on: ${new Date(report.timestamp).toLocaleString()}

## Summary

- **Bundle Size**: ${report.summary.bundleSize}
- **Memory Leaks**: ${report.summary.memoryLeaks}
- **Dependencies**: ${report.summary.dependencies}

## Recommendations

${report.recommendations.map(rec => `- ${rec}`).join('\n')}

## Next Steps

${report.nextSteps.map(step => `- ${step}`).join('\n')}

---
*Generated by Performance Optimizer*
`;
  }
}

// Run the optimizer
const optimizer = new PerformanceOptimizer();
optimizer.run().catch(console.error); 