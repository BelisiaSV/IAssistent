/** Result of a club form (admin and club screens). */
export type FormState = { error?: string; ok?: string };

/** Result of making an activation code: the code is shown once. */
export type CodeState = { error?: string; code?: string };

export type FormAction<S> = (prev: S, formData: FormData) => Promise<S>;
