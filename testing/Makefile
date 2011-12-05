includes := $(shell pkg-config --libs --cflags gtk+-2.0)
executables :=  gtk_icon_example trayicon hide xtypes

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
