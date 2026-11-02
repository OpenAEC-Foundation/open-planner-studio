use std::sync::mpsc::Receiver;
use std::time::Duration;

pub const RETRY_INTERVAL: Duration = Duration::from_millis(250);

// Afzonderlijk van Tauri zodat de native afsluitbeslissing dezelfde grensproef kan gebruiken.
pub fn wait_for_confirmation(
    receiver: &Receiver<()>,
    interval: Duration,
    mut request: impl FnMut(),
    mut exit: impl FnMut(i32),
) -> bool {
    for _ in 0..100 {
        request();
        if receiver.recv_timeout(interval).is_ok() {
            exit(0);
            return true;
        }
    }
    exit(1);
    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::{Cell, RefCell};
    use std::sync::mpsc;

    #[test]
    fn a_write_beyond_the_old_deadline_must_finish_before_native_exit() {
        let (sender, receiver) = mpsc::channel();
        let requests = Cell::new(0);
        let writing = Cell::new(true);
        let exits = RefCell::new(Vec::new());
        let confirmed = wait_for_confirmation(
            &receiver,
            Duration::ZERO,
            || {
                requests.set(requests.get() + 1);
                if requests.get() == 103 {
                    writing.set(false);
                    sender.send(()).unwrap();
                }
            },
            |code| exits.borrow_mut().push((code, writing.get())),
        );
        assert_eq!(
            *exits.borrow(),
            vec![(0, false)],
            "geen native exit terwijl een write of herstelronde nog bezig is"
        );
        assert!(confirmed);
        assert_eq!(requests.get(), 103);
    }

    #[test]
    fn a_missing_confirmation_is_not_permission_to_exit() {
        let (sender, receiver) = mpsc::channel();
        drop(sender);
        let exits = RefCell::new(Vec::new());
        let confirmed = wait_for_confirmation(
            &receiver,
            Duration::ZERO,
            || {},
            |code| exits.borrow_mut().push(code),
        );
        assert!(!confirmed);
        assert!(
            exits.borrow().is_empty(),
            "geen afsluiten bij een verbroken bevestigingskanaal"
        );
    }

    #[test]
    fn a_successful_confirmation_exits_once() {
        let (sender, receiver) = mpsc::channel();
        sender.send(()).unwrap();
        let mut exits = Vec::new();
        assert!(wait_for_confirmation(
            &receiver,
            Duration::ZERO,
            || {},
            |code| exits.push(code),
        ));
        assert_eq!(exits, vec![0]);
    }
}
