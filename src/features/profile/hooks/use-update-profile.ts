import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";

export interface UpdateProfileInput {
  full_name: string;
  /** Optional new password; ignored when empty. */
  password?: string;
}

/**
 * Update the signed-in user's profile: display name (user_metadata.full_name)
 * and, optionally, password. Email changes are intentionally out of scope —
 * they require a confirmation flow.
 */
export function useUpdateProfile() {
  return useMutation({
    mutationFn: async ({ full_name, password }: UpdateProfileInput) => {
      const attrs: { data: { full_name: string }; password?: string } = {
        data: { full_name },
      };
      if (password && password.length > 0) {
        attrs.password = password;
      }

      const { data, error } = await supabase.auth.updateUser(attrs);
      if (error) throw error;
      return data;
    },
  });
}
