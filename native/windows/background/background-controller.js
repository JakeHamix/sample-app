define([
  '../../scripts/constants/window-names.js',
  '../../scripts/services/running-game-service.js',
  '../../scripts/services/windows-service.js',
  '../../scripts/services/hotkeys-service.js',
  '../../scripts/services/gep-service.js',
  '../../scripts/services/event-bus.js'
], function (WindowNames,
             runningGameService,
             WindowsService,
             hotkeysService,
             gepService,
             eventBus) {

  class BackgroundController {
    static async run() {
      // this will be available when calling overwolf.windows.getMainWindow()
      window.ow_eventBus = eventBus;
      window.minimize = BackgroundController.minimize;

      // Handle what happens when the app is launched while already running
      // (relaunch)
      BackgroundController._registerAppLaunchTriggerHandler();
      // Register handlers to hotkey events
      BackgroundController._registerHotkeys();

      let isGameRunning = await runningGameService.isGameRunning();

      // Obtain windows and set their sizes:
      // Desktop:
      const desktopWindowName = await WindowsService.getStartupWindowName();
      const desktopWindow = await WindowsService.obtainWindow(desktopWindowName);
      await WindowsService.changeSize(desktopWindow.window.id, 1200, 659);
      await WindowsService.changePositionCenter(desktopWindowName);
      // In-Game:
      const inGameWindow = await WindowsService.obtainWindow(WindowNames.IN_GAME);
      await WindowsService.changeSize(inGameWindow.window.id, 1641, 692);


      if (!isGameRunning) {
        WindowsService.restore(desktopWindowName);
        BackgroundController._displayNotification('asdas', 'asdsad', 100, 100, 1);
      }
      else {
        gepService.registerToGEP(BackgroundController.onGameEvents, BackgroundController.onInfoUpdate);
        await WindowsService.restore(WindowNames.IN_GAME);
        WindowsService.minimize(WindowNames.IN_GAME);
      }

      runningGameService.addGameRunningChangedListener((isGameRunning) => {
        if (isGameRunning) {
          // Close desktop window
          WindowsService.close(WindowNames.DESKTOP);
          // Open in-game window
          WindowsService.restore(WindowNames.IN_GAME);
        } else {
          // Close in-game window
          WindowsService.close(WindowNames.IN_GAME);
          // Open desktop window
          WindowsService.restore(WindowNames.DESKTOP);
        }
      });
    }

    /**
     * Minimize all app windows
     * @public
     */
    static async minimize() {
      const openWindows = await WindowsService.getOpenWindows();
      for (let windowName in openWindows) {
        await WindowsService.minimize(windowName);
      }
    }

    /**
     * Display notification
     * @private
     */
    static async _displayNotification(title, message, left, top, time) {
      const data = { title, message };
      const notificationWindow = await WindowsService.obtainWindow(WindowNames.NOTIFICATION);

      await WindowsService.changeSize(WindowNames.NOTIFICATION, 320, 260);
      await WindowsService.changePositionCenter(WindowNames.NOTIFICATION);
      // Tell the notification what it should display
      window.ow_eventBus.trigger('notification', data);

      // Display notification
      await WindowsService.restore(WindowNames.NOTIFICATION);
      // Start notification timer
      setTimeout(() => {
        window.ow_eventBus.trigger('notification-time', time);
      }, 20);
    }

    /**
     * handles app launch trigger event - i.e dock icon clicked
     * @private
     */
    static _registerAppLaunchTriggerHandler() {
      overwolf.extensions.onAppLaunchTriggered.removeListener(
        BackgroundController._onAppRelaunch);
      overwolf.extensions.onAppLaunchTriggered.addListener(
        BackgroundController._onAppRelaunch);
    }

    static _onAppRelaunch() {
      WindowsService.restore(WindowNames.DESKTOP);
    }

    /**
     * set custom hotkey behavior
     * @private
     */
    static _registerHotkeys() {
      hotkeysService.setToggleHotkey(async () => {
        let state = await WindowsService.getWindowState(WindowNames.IN_GAME);
        if ((state === 'minimized') || (state === 'closed')) {
          WindowsService.restore(WindowNames.IN_GAME)
        } else if ((state === 'normal') || (state === 'maximized')) {
          WindowsService.minimize(WindowNames.IN_GAME)
        }
      });
    }

    /**
     * Pass events to windows that are listening to them
     * @private
     */
    static onGameEvents(data) {
      for (let event of data.events) {
        console.log(JSON.stringify(event));
        window.ow_eventBus.trigger('event', event);
      }
    }

    /**
     * Pass info updates to windows that are listening to them
     * @private
     */
    static onInfoUpdate(data) {
      window.ow_eventBus.trigger('info', data);
    }
  }


  return BackgroundController;
});
