// ★ Supabase Realtime 실시간 동기화 구독 추가
  useEffect(() => {
    if (!workerId) return;

    // 1. 'inspections' 테이블의 변경사항을 실시간으로 구독하는 채널 생성
    const channel = supabase
      .channel('realtime-inspections')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE 모든 이벤트 감지
          schema: 'public',
          table: 'inspections',
          filter: `worker_id=eq.${workerId}`, // 현재 로그인한 작업자의 데이터만 실시간 동기화
        },
        (payload) => {
          console.log('⚡ [실시간 동기화 감지]:', payload);
          
          // 데이터가 추가되거나 수정되면 자동으로 과거 기록 state를 최신화
          if (payload.eventType === 'INSERT') {
            setPastReports((prev) => [payload.new, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setPastReports((prev) =>
              prev.map((item) => (item.id === payload.new.id ? payload.new : item))
            );
          } else if (payload.eventType === 'DELETE') {
            setPastReports((prev) => prev.filter((item) => item.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    // 2. 컴포넌트가 언마운트되거나 계정이 바뀔 때 구독 해제 (메모리 누수 방지)
    return () => {
      supabase.removeChannel(channel);
    };
  }, [workerId]);