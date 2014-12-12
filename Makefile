all: moslack.xpi

FILES := \
	install.rdf \
	bootstrap.js \
	chrome.manifest \
	prpl.js \
	$(wildcard content/*) \
	${NULL}

moslack.xpi: Makefile

moslack.xpi: ${FILES}
	-rm -f $@
	@zip -r $@ $^

install.rdf: install.rdf.rb
	ruby $< > $@

clean:
	rm -f moslack.xpi install.rdf

# Use in combination with the extension auto-installer extension
install: moslack.xpi
	curl $(if V,--verbose) --header Expect: --data-binary @$< http://localhost:8888/

.PHONY: clean install
