// File: scripts/generateSlugs.js

const mongoose = require('mongoose');
const slugify = require('slugify');
const dotenv = require('dotenv');
const College = require('../modules/collegeModule'); // Adjust path if your model is elsewhere

// Load environment variables (e.g., DATABASE_URL)
dotenv.config({ path: '../.env' }); // Adjust path to your .env file if script is not in root

/**
 * Generates a unique slug for a college.
 * If the initial slug exists, it appends a counter.
 * @param {string} name - The college name to slugify.
 * @param {string} [excludeId] - Optional: an ID to exclude from the duplicate check (for updates).
 * @returns {Promise<string>} - A unique slug.
 */
async function generateUniqueSlug(name, excludeId = null) {
    let baseSlug = slugify(name, { lower: true, strict: true, remove: /[*+~.()'"!:@]/g });
    let slug = baseSlug;
    let counter = 1;

    // Build the query for checking existing slugs
    const query = { slug: slug };
    if (excludeId) {
        query._id = { $ne: excludeId }; // Exclude the current document if updating
    }

    // Check if slug exists
    while (await College.findOne(query)) {
        slug = `${baseSlug}-${counter}`;
        query.slug = slug; // Update query for the next check
        counter++;
    }
    return slug;
}

/**
 * Main function to find colleges without slugs and update them.
 */
async function updateMissingSlugs() {
    if (!process.env.MONGODB_URL) {
        console.error("MONGODB_URL not found in environment variables. Make sure it's in your .env file.");
        process.exit(1);
    }

    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URL);
        console.log('MongoDB Connected Successfully.');

        // Find colleges where slug is null, empty, or doesn't exist
        const collegesToUpdate = await College.find({
            $or: [
                { slug: null },
                { slug: "" },
                { slug: { $exists: false } }
            ]
        });

        if (collegesToUpdate.length === 0) {
            console.log('No colleges found requiring slug updates.');
            return;
        }

        console.log(`Found ${collegesToUpdate.length} college(s) to update with slugs.`);
        let updatedCount = 0;

        for (const college of collegesToUpdate) {
            if (!college.name) {
                console.warn(`College with ID ${college._id} has no name, cannot generate slug. Skipping.`);
                continue;
            }

            try {
                const newSlug = await generateUniqueSlug(college.name, college._id);
                college.slug = newSlug;
                await college.save(); // Using .save() will trigger the pre-save hook if you have one
                // Alternatively, for direct update:
                // await College.updateOne({ _id: college._id }, { $set: { slug: newSlug } });
                updatedCount++;
                console.log(`Updated college "${college.name}" (ID: ${college._id}) with slug: "${newSlug}"`);
            } catch (error) {
                console.error(`Error updating slug for college "${college.name}" (ID: ${college._id}):`, error.message);
                // Handle potential duplicate slug errors if generateUniqueSlug fails or if unique index is very strict
                if (error.code === 11000) {
                    console.error(`  -> This might be a duplicate slug issue that wasn't caught by generateUniqueSlug. Consider manual review or a more robust uniqueness check.`);
                }
            }
        }

        console.log(`\nSlug generation complete. ${updatedCount} college(s) updated.`);

    } catch (error) {
        console.error('Error during slug generation script:', error);
    } finally {
        await mongoose.disconnect();
        console.log('MongoDB Disconnected.');
    }
}

// Run the script
updateMissingSlugs();
