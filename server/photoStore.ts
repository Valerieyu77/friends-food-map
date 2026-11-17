import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "photos";

export interface PhotoStore {
  /** Saves a JPEG and returns its file name. */
  save(jpeg: Buffer): Promise<string>;
  remove(photoFile: string): Promise<void>;
  urlFor(photoFile: string): string;
}

/**
 * Photos live in a Supabase Storage bucket. The bucket is public so phones can load photos directly,
 * and each file name is a random UUID, so a photo can only be found through its group's feed.
 */
export function createSupabasePhotoStore(projectUrl: string, secretKey: string): PhotoStore {
  // People often copy the API address (ending in /rest/v1/); the client needs only the project's origin.
  const supabase = createClient(new URL(projectUrl).origin, secretKey, { auth: { persistSession: false } });
  let bucketReady: Promise<void> | undefined;

  function ready(): Promise<void> {
    bucketReady ??= (async () => {
      const { data } = await supabase.storage.getBucket(BUCKET);
      if (data) return;
      const { error } = await supabase.storage.createBucket(BUCKET, { public: true, allowedMimeTypes: ["image/jpeg"] });
      if (error) throw new Error(`Could not create the photo bucket: ${error.message}`);
    })();
    return bucketReady;
  }

  return {
    async save(jpeg) {
      await ready();
      const fileName = `${randomUUID()}.jpg`;
      const { error } = await supabase.storage.from(BUCKET).upload(fileName, jpeg, { contentType: "image/jpeg" });
      if (error) throw new Error(`Photo upload failed: ${error.message}`);
      return fileName;
    },
    async remove(photoFile) {
      await supabase.storage.from(BUCKET).remove([photoFile]);
    },
    urlFor(photoFile) {
      return supabase.storage.from(BUCKET).getPublicUrl(photoFile).data.publicUrl;
    },
  };
}
