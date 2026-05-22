export type PersonaFormState = {
  fieldErrors: {
    name?: string;
  };
  formError: string | null;
};

export const emptyPersonaFormState: PersonaFormState = {
  fieldErrors: {},
  formError: null,
};
