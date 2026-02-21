import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const supabaseUrl = "https://wktosroqlanmjwbanssy.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrdG9zcm9xbGFubWp3YmFuc3N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwNDg3ODIsImV4cCI6MjA3OTYyNDc4Mn0.FlRLoK8RVflxpIDnnVl5u8sCGffAWrXfHO216DX5PPQ";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
