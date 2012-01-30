includes := $(shell pkg-config --libs --cflags gtk+-2.0)
executables :=  gtk_icon_example trayicon hide xtypes x11XGetWindowProp \
	window_state_event xev_desktop teststatusicon

.PHONY: all
all: $(executables)

.PHONY: clean
clean:
	rm $(executables)

gtk_icon_example: gtk_icon_example.c
	gcc $(includes) -o gtk_icon_example gtk_icon_example.c

trayicon: trayicon.c
	gcc $(includes) -o trayicon trayicon.c

hide: hide.c
	gcc $(includes) -o hide hide.c

xtypes: xtypes.c
	gcc $(includes) -o xtypes xtypes.c

x11XGetWindowProp: x11XGetWindowProp.c
	gcc -Wall x11XGetWindowProp.c -o x11XGetWindowProp -lm -lXext -lX11

window_state_event: window_state_event.c
	gcc $(includes) -o window_state_event window_state_event.c

xev_desktop: xev_desktop.c
	gcc -lXm -lXt -lX11 -o xev_desktop xev_desktop.c

teststatusicon: teststatusicon.c prop-editor.c
	gcc $(includes) -o teststatusicon teststatusicon.c prop-editor.c
