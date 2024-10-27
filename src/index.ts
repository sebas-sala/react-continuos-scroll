import { useCallback, useEffect, useRef, useState } from "react";

interface InfiniteScrollProps<T> {
	loadMore: boolean;
	onLoadMore: (page: number) => Promise<T[]>;
	idKey?: string;
	initialData?: T[];
	threshold?: number;
	fallbackData?: T[];
	initialPage?: number;
	maxAttempts?: number;
	timeout?: number;
	onMaxAttemptsReached?: () => void;
}

function uniqueByObjectKey<T>(arr: T[], idKey: string) {
	if (
		!idKey ||
		!arr.length ||
		typeof idKey !== "string" ||
		!Object.prototype.hasOwnProperty.call(arr[0], idKey)
	)
		return arr;

	const seen = new Set();
	return arr.filter((item) => {
		const key = item[idKey as keyof T];
		if (!key || seen.has(key)) return false;
		seen.add(idKey);
		return true;
	});
}

export const useInfiniteScroll = <T>({
	idKey,
	initialData = [],
	initialPage = 1,
	fallbackData = [],
	loadMore,
	threshold = 0.5,
	maxAttempts = 3,
	onLoadMore,
	timeout = 0,
	onMaxAttemptsReached,
}: InfiniteScrollProps<T>) => {
	const [data, setData] = useState<T[]>(initialData);
	const [page, setPage] = useState<number>(initialPage);
	const [error, setError] = useState<Error | null>(null);
	const [loading, setLoading] = useState<boolean>(false);
	const loadMoreRef = useRef<HTMLDivElement | null>(null);
	const attempts = useRef<number>(0);
	const observer = useRef<IntersectionObserver | null>(null);
	const lastPage = useRef<number>(initialPage - 1);

	const loadMoreData = useCallback(async () => {
		if (loading) return;
		if (!loadMore) return;
		if (page === lastPage.current) return;
		if (attempts.current >= maxAttempts) return;

		setLoading(true);
		attempts.current += 1;

		try {
			const newData = await onLoadMore(page);

			let uniqueData: T[];

			if (idKey) {
				uniqueData = uniqueByObjectKey([...data, ...newData], idKey);
			} else {
				uniqueData = [...data, ...newData];
			}

			setData(uniqueData);
			lastPage.current = page;
			setPage((prevPage) => prevPage + 1);

			attempts.current = 0;
		} catch (error) {
			if (attempts.current >= maxAttempts && onMaxAttemptsReached) {
				onMaxAttemptsReached();
			}

			setError(error as Error);
			setData((prevData) => [...prevData, ...fallbackData]);
		} finally {
			setLoading(false);

			if (timeout > 0) {
				await new Promise((resolve) => setTimeout(resolve, timeout));
			}
		}
	}, [
		loadMore,
		page,
		onLoadMore,
		loading,
		maxAttempts,
		onMaxAttemptsReached,
		fallbackData,
		data,
		idKey,
		timeout,
	]);

	useEffect(() => {
		if (!loadMore || loading || !loadMoreRef.current) return;

		const observerCallback: IntersectionObserverCallback = (entries) => {
			if (entries[0].isIntersecting) {
				loadMoreData();
			}
		};

		const currentRef = loadMoreRef.current;
		observer.current = new IntersectionObserver(observerCallback, {
			threshold,
		});
		observer.current.observe(currentRef);

		return () => {
			if (observer.current && currentRef) {
				observer.current.unobserve(currentRef);
			}
		};
	}, [loadMoreData, threshold, loadMore, loading]);

	return {
		page,
		data,
		error,
		loading,
		loadMore,
		loadMoreRef,
	};
};
