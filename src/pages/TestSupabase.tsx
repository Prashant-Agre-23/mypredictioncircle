import { useEffect } from 'react';
import { supabase } from '../config/supabaseClient';

const TestSupabase = () => {
  useEffect(() => {
    const testConnection = async () => {
      const { data, error } = await supabase
        .from('test')
        .select('*');

      console.log(data, error);
    };

    testConnection();
  }, []);

  return <div>Check console for Supabase response</div>;
};

export default TestSupabase;
