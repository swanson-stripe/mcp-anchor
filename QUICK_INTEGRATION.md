# 🚀 **Instant Prototype Data with MCP Anchor + Synthetic Dataset**

Get realistic payment data in your prototype with **2 simple Cursor prompts** - no configuration needed.

## **One-Line Setup**

```bash
npx mcp-anchor init --with-dataset
```

This automatically:
✅ Downloads the [synthetic-dataset](https://github.com/swanson-stripe/synthetic-dataset) repository  
✅ Configures MCP server with persona switching  
✅ Sets up API endpoints with realistic business data  
✅ Provides Cursor with ready-to-use prompts

## **Cursor Prompts (Copy & Paste)**

### **Prompt 1: Add Dataset to Your App**

```
Use MCP Anchor to add realistic synthetic data to my React app. I want:
- Customer list with realistic names and details
- Revenue metrics and payment data  
- Business: [modaic/mindora/keynest/pulseon/fluxly/brightfund/procura/stratus/forksy]
- Stage: [early/growth/mature]

Set up the API client boundary and show the data in components.
```

### **Prompt 2: Switch Business Scenarios**  

```
Switch my app to use [business_name] data at [stage] stage. Update the components to show:
- Different customer patterns
- Industry-specific metrics
- Realistic transaction volumes for this business type

Keep the same UI structure but with new realistic data.
```

## **What You Get Instantly**

### **🏢 9 Ready Business Personas**
- **modaic** - Fashion e-commerce (150K payments)
- **mindora** - Online education platform
- **keynest** - Property management SaaS
- **pulseon** - Fitness subscription service
- **fluxly** - Creator monetization platform
- **brightfund** - Non-profit fundraising
- **procura** - B2B medical supplies
- **stratus** - Cloud infrastructure (usage billing)
- **forksy** - Food delivery marketplace

### **📊 3 Growth Stages per Business**
- **Early**: Startup phase with initial traction
- **Growth**: Scaling with increasing volume
- **Mature**: Established business with complex patterns

### **🎯 Realistic Data Types**
- Customer profiles with industry-appropriate names/emails
- Payment transactions with realistic amounts and patterns
- Subscription billing (for SaaS businesses)
- Marketplace split payments (for platforms)
- Revenue metrics with seasonal patterns
- Churn analysis and cohort data

## **How It Works Under the Hood**

1. **MCP Server** provides Cursor with tools to manipulate data
2. **Synthetic Dataset** serves as the data source with 9 businesses × 3 stages
3. **API Boundary** injects data seamlessly into your app
4. **Persona Switching** changes entire dataset with one command

## **Example: Fashion E-commerce in 30 Seconds**

```typescript
// Cursor generates this automatically from Prompt 1:

import { useDataset } from './hooks/useDataset';

function Dashboard() {
  const { customers, metrics, transactions } = useDataset({
    business: 'modaic',  // Fashion e-commerce
    stage: 'growth'      // Scaling phase
  });

  return (
    <div>
      <MetricCards data={metrics} />
      <CustomerList customers={customers} />
      <RevenueChart transactions={transactions} />
    </div>
  );
}
```

## **Switch Scenarios Instantly**

```typescript
// Change to fitness subscription business:
const { customers, metrics, subscriptions } = useDataset({
  business: 'pulseon',  // Fitness subscriptions
  stage: 'mature'       // Established business
});

// Now you have realistic fitness industry data:
// - Customers: "Sarah M.", "Mike T." (fitness names)
// - Metrics: Monthly recurring revenue, churn rates
// - Transactions: $29.99 monthly subscriptions, annual plans
```

## **Real-World Business Patterns**

Each business persona includes realistic industry patterns:

### **Fashion E-commerce (modaic)**
- Seasonal sales spikes (Black Friday, holidays)
- Average order values: $45-120
- Return/refund rates: 8-12%
- Peak traffic: October-December

### **SaaS Platform (stratus)**  
- Monthly recurring revenue growth
- Trial-to-paid conversion: 18-25%
- Annual plan discounts
- Usage-based billing spikes

### **Food Delivery (forksy)**
- Peak hours: 11:30am-2pm, 6pm-9pm
- Average order: $28-45
- Driver payouts and tips
- Restaurant commission splits

## **Advanced Usage**

### **Custom Business Scenarios**
```bash
# Create hybrid scenarios
npx mcp-anchor scenario create --base=modaic --add-fraud-spike --seed=42
```

### **Data Transforms**
```bash
# Apply realistic edge cases
npx mcp-anchor transform --scenario=heavy-tail --business=fluxly
```

### **Export for Design Tools**
```bash
# Generate JSON for Figma/Sketch
npx mcp-anchor export --format=figma --business=mindora --customers=100
```

## **Why This Works**

✅ **Zero Config**: No setup files, no API keys, no database  
✅ **Industry Realistic**: Data matches actual business patterns  
✅ **Cursor Optimized**: Prompts designed for AI code generation  
✅ **Instant Switching**: Change entire business context in seconds  
✅ **Production Feel**: Data quality that impresses stakeholders  

## **Get Started Now**

```bash
# Install and auto-configure
npx mcp-anchor init --with-dataset

# Open Cursor and paste Prompt 1
# Your prototype now has realistic data!
```

**Perfect for**: Design systems, investor demos, user testing, stakeholder presentations, frontend development, API prototyping.
