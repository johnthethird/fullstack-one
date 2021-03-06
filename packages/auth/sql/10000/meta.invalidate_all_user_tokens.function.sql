-- invalidate_all_user_tokens invalidates tokens of the current user ever created before the current time
CREATE OR REPLACE FUNCTION _meta.invalidate_all_user_tokens(i_user_id TEXT, i_user_token TEXT, i_provider TEXT, i_timestamp BIGINT) RETURNS void AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_is_user_token_valid BOOLEAN;
    v_auth_table TEXT;
    v_auth_table_schema TEXT;
    v_auth_field_password TEXT;
    v_query TEXT;
    v_invalid_tokens BIGINT[];
    v_user_id TEXT;
    v_password jsonb;
    v_timestamp BIGINT;
BEGIN
    -- Check if the user is admin. Raise exeption if not.
	v_is_admin := _meta.is_admin();
	IF v_is_admin = FALSE THEN
        RAISE EXCEPTION 'You are not permitted to execute this operation.';
    END IF;

    -- Check if the user-token is valid. Return if not.
    v_is_user_token_valid := _meta.is_user_token_valid(i_user_id, i_user_token, i_provider, i_timestamp, false, false);
    IF v_is_user_token_valid = FALSE THEN
        RETURN;
    END IF;

    -- TODO: We may could improve this to one query
    -- Get required values from Auth-table
    SELECT value INTO v_auth_table FROM _meta."Auth" WHERE key = 'auth_table';
    SELECT value INTO v_auth_table_schema FROM _meta."Auth" WHERE key = 'auth_table_schema';
    SELECT value INTO v_auth_field_password FROM _meta."Auth" WHERE key = 'auth_field_password';

    -- Get password-field and userId from user by userId
    v_query := $tok$SELECT id, %I FROM %I.%I WHERE id = %L$tok$;
    EXECUTE format(v_query, v_auth_field_password, v_auth_table_schema, v_auth_table, i_user_id) INTO v_user_id, v_password;

    -- Check if user exists and password-field is not null
    IF v_user_id IS NULL OR v_password IS NULL THEN
        RAISE EXCEPTION 'Invalidation failed!';
    END IF;

    -- Create new empty invalidTokens array, because all manually invalidate tokens are invalid anyway by setting totalLogoutTimestamp
    v_invalid_tokens := ARRAY[]::BIGINT[];

    -- Set new invalidTokens array into password-field
    v_password := jsonb_set(v_password, ARRAY['invalidTokens'], to_jsonb(v_invalid_tokens));

    -- Get current timestamp
    v_timestamp := (round(extract(epoch from now())*1000))::bigint;

    -- Set totalLogoutTimestamp to the current timestamp, to invalid all user-tokens issued before.
    v_password := jsonb_set(v_password, ARRAY['totalLogoutTimestamp'], to_jsonb(v_timestamp));

    -- Write the updated password-field to db
    EXECUTE format('UPDATE %I.%I SET %I = %L WHERE id = %L', v_auth_table_schema, v_auth_table, v_auth_field_password, v_password, i_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;