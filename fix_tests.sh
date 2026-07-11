#!/bin/bash

# Function to replace content in files
fix_file() {
    local file=$1
    echo "Processing: $file"
}

# Fix FishingTaskCard.test.tsx
if [ -f "src/components/downtime/views/__tests__/FishingTaskCard.test.tsx" ]; then
    echo "Fixing FishingTaskCard.test.tsx"
    sed -i "s/supportedModes: \['Fishing'\]/description: 'A peaceful river', species: []/g" src/components/downtime/views/__tests__/FishingTaskCard.test.tsx
    sed -i "s/defaultsByMode: {},//g" src/components/downtime/views/__tests__/FishingTaskCard.test.tsx
    sed -i "s/skillMod: 0,//g" src/components/downtime/views/__tests__/FishingTaskCard.test.tsx
    sed -i "s/type: 'fish',/category: 'fish',/g" src/components/downtime/views/__tests__/FishingTaskCard.test.tsx
    sed -i "s/tags: \[\],/baseYield: 1, skill: 'Fishing', difficulty: 12, environments: ['spot-river'],/g" src/components/downtime/views/__tests__/FishingTaskCard.test.tsx
    sed -i "/foodType:/d; /yieldMeatFormula:/d; /secondaryMaterialType:/d; /yieldSecondaryFormula:/d; /secondaryNameOverride:/d; /st:/d; /specialRules:/d" src/components/downtime/views/__tests__/FishingTaskCard.test.tsx
fi

