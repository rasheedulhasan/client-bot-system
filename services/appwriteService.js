const { Client, Databases } = require('node-appwrite');
require('dotenv').config();

const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID);

// Only set API key if it exists (for server-side operations)
if (process.env.APPWRITE_API_KEY && process.env.APPWRITE_API_KEY !== 'your_appwrite_api_key_here') {
    client.setKey(process.env.APPWRITE_API_KEY);
}

const databases = new Databases(client);

/**
 * Normalizes and formats category names
 * e.g., "burger" -> "Burgers"
 */
const formatCategoryName = (category) => {
    if (!category) return 'Other';
    const trimmed = category.trim();
    if (!trimmed) return 'Other';
    
    // Capitalize first letter
    const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
    
    // Add plural if not present (simple heuristic)
    if (!capitalized.endsWith('s')) {
        return capitalized + 's';
    }
    return capitalized;
};

/**
 * Fetches menu items from Appwrite and groups them by category
 */
const getMenuFromAppwrite = async () => {
    try {
        const response = await databases.listDocuments(
            process.env.APPWRITE_DATABASE_ID,
            process.env.APPWRITE_COLLECTION_ID
        );

        const items = response.documents;
        const categoriesMap = new Map();

        items.forEach(doc => {
            const rawCategory = doc.category || 'Other';
            const displayName = formatCategoryName(rawCategory);
            const normalizedCategory = rawCategory.trim().toLowerCase();

            if (!categoriesMap.has(normalizedCategory)) {
                categoriesMap.set(normalizedCategory, {
                    name: displayName,
                    category: capitalized(rawCategory.trim()), // Original formatted for category ID/filter
                    items: []
                });
            }

            categoriesMap.get(normalizedCategory).items.push({
                id: doc.$id,
                title: doc.title,
                description: doc.description || '',
                price: doc.price || 0,
                imageUrl: doc.imageUrl || '',
                isDefault: doc.isDefault || false,
                createdAt: doc.$createdAt
            });
        });

        // Convert Map to Array and sort
        const categories = Array.from(categoriesMap.values()).sort((a, b) => 
            a.name.localeCompare(b.name)
        );

        // Sort items within each category by title
        categories.forEach(cat => {
            cat.items.sort((a, b) => a.title.localeCompare(b.title));
        });

        return { categories };
    } catch (error) {
        console.error('Appwrite Service Error:', error);
        throw error;
    }
};

const capitalized = (str) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

module.exports = {
    getMenuFromAppwrite
};
