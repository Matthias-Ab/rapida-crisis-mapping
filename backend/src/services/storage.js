const Minio = require('minio')
const sharp = require('sharp')
const { v4: uuidv4 } = require('uuid')

const client = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000', 10),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin'
})

const BUCKET = process.env.MINIO_BUCKET || 'crisis-reports'

/**
 * Create the MinIO bucket if it does not exist, and apply a public-read
 * bucket policy scoped to the thumbnails/ prefix.
 */
async function initializeBucket() {
  try {
    const exists = await client.bucketExists(BUCKET)
    if (!exists) {
      await client.makeBucket(BUCKET, 'us-east-1')
    }
  } catch (err) {
    // On managed S3 providers (Cloudflare R2, Supabase) the bucket is
    // pre-created in the console — a 403/409 here is non-fatal.
    if (!err.message?.includes('BucketAlreadyOwnedByYou')) {
      console.warn('initializeBucket: could not create bucket —', err.message)
    }
  }

  // Apply public-read policy. Cloudflare R2 manages access via the dashboard;
  // setBucketPolicy is not supported there so we catch and continue.
  try {
    const policy = JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [
            `arn:aws:s3:::${BUCKET}/photos/*`,
            `arn:aws:s3:::${BUCKET}/thumbnails/*`
          ]
        }
      ]
    })
    await client.setBucketPolicy(BUCKET, policy)
  } catch {
    // Silently ignored on providers that don't support bucket policies
  }
}

/**
 * Upload a buffer to MinIO at the given key.
 * Returns the public URL for the object.
 *
 * @param {Buffer} buffer
 * @param {string} key - object path inside the bucket
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} public URL
 */
async function uploadFile(buffer, key, contentType) {
  const metadata = { 'Content-Type': contentType }
  await client.putObject(BUCKET, key, buffer, buffer.length, metadata)

  const endpoint = process.env.MINIO_ENDPOINT || 'localhost'
  const port = process.env.MINIO_PORT || '9000'
  const useSSL = process.env.MINIO_USE_SSL === 'true'
  const protocol = useSSL ? 'https' : 'http'

  // If a public base URL is configured (e.g. via nginx proxy), use it
  if (process.env.MINIO_PUBLIC_URL) {
    return `${process.env.MINIO_PUBLIC_URL}/${BUCKET}/${key}`
  }

  return `${protocol}://${endpoint}:${port}/${BUCKET}/${key}`
}

/**
 * Generate a pre-signed GET URL for a private object.
 *
 * @param {string} key
 * @param {number} expiry - seconds until expiry (default 7 days)
 * @returns {Promise<string>}
 */
async function getSignedUrl(key, expiry = 604800) {
  return client.presignedGetObject(BUCKET, key, expiry)
}

/**
 * Delete an object from MinIO.
 *
 * @param {string} key
 */
async function deleteFile(key) {
  await client.removeObject(BUCKET, key)
}

/**
 * Process an uploaded photo:
 *  - Auto-rotate based on EXIF orientation
 *  - Strip all EXIF metadata
 *  - Resize to max 1920px on the longest edge (no upscaling)
 *  - Convert to progressive JPEG at 85% quality
 *  - Upload to photos/ prefix
 *
 * @param {Buffer} inputBuffer - raw upload buffer
 * @returns {Promise<{ photoUrl: string, photoKey: string }>}
 */
async function processAndUploadPhoto(inputBuffer) {
  const processed = await sharp(inputBuffer)
    .rotate()                                                   // auto-orient from EXIF, then strips orientation tag
    .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85, progressive: true, mozjpeg: false })
    .toBuffer()

  const key = `photos/${uuidv4()}.jpg`
  const url = await uploadFile(processed, key, 'image/jpeg')
  return { photoUrl: url, photoKey: key }
}

/**
 * Generate and upload a thumbnail from an uploaded photo:
 *  - Auto-rotate
 *  - Resize to max 400px on the longest edge
 *  - JPEG at 70% quality
 *  - Upload to thumbnails/ prefix (publicly readable)
 *
 * @param {Buffer} inputBuffer - raw upload buffer
 * @returns {Promise<{ thumbnailUrl: string, thumbnailKey: string }>}
 */
async function processAndUploadThumbnail(inputBuffer) {
  const thumbnail = await sharp(inputBuffer)
    .rotate()
    .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 70 })
    .toBuffer()

  const key = `thumbnails/${uuidv4()}.jpg`
  const url = await uploadFile(thumbnail, key, 'image/jpeg')
  return { thumbnailUrl: url, thumbnailKey: key }
}

module.exports = {
  initializeBucket,
  uploadFile,
  getSignedUrl,
  deleteFile,
  processAndUploadPhoto,
  processAndUploadThumbnail
}
